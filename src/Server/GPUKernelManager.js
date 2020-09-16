import {GPU} from 'gpu.js';

import VoxelConstants from '../VoxelConstants';
import {FIRE_SPECTRUM_WIDTH} from '../Spectrum';

class GPUKernelManager {
  constructor(gridSize) {
    this.gpu = new GPU({mode: 'headlessgl'});

    this.gpu.addFunction(function clampValue(value, min, max) {
      return Math.min(max, Math.max(min, value));
    });

    this.pipelineFuncSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true, // We use pipelining for most things in order to get a texture output from kernels
      constants: {
        VOXEL_ERR_UNITS_SQR: VoxelConstants.VOXEL_ERR_UNITS*VoxelConstants.VOXEL_ERR_UNITS,
        gridSize: gridSize,
        halfGridSize: gridSize/2,
      },
      returnType: 'Array(3)',
      immutable: false,
    };

    // Setup the GPU/Compute kernels...

    // Utility kernels
    this.clearFunc = this.gpu.createKernel(function(colour) {
      return [colour[0], colour[1], colour[2]];
    }, {...this.pipelineFuncSettings, immutable: false, argumentTypes: {colour: 'Array(3)'}});

    this.multiplyColourFunc = this.gpu.createKernel(function(pipelineTex, colour) {
      const currVoxel = pipelineTex[this.thread.z][this.thread.y][this.thread.x];
      return [currVoxel[0]*colour[0], currVoxel[1]*colour[1], currVoxel[2]*colour[2]];
    }, {...this.pipelineFuncSettings, argumentTypes: {pipelineTex: 'Array3D(3)', colour: 'Array(3)'}});

    // Framebuffer combination kernels
    this.addFramebuffersFunc = this.gpu.createKernel(function(framebufTexA, framebufTexB) {
      const fbAVoxel = framebufTexA[this.thread.z][this.thread.y][this.thread.x];
      const fbBVoxel = framebufTexB[this.thread.z][this.thread.y][this.thread.x];
      return [clampValue(fbAVoxel[0]+fbBVoxel[0], 0.0, 1.0), clampValue(fbAVoxel[1]+fbBVoxel[1], 0.0, 1.0), clampValue(fbAVoxel[2]+fbBVoxel[2], 0.0, 1.0)];
    }, {...this.pipelineFuncSettings, argumentTypes: {framebufTexA: 'Array3D(3)', framebufTexB: 'Array3D(3)'}});

    this.copyFramebufferFunc = this.gpu.createKernel(function(framebufTex) {
      return framebufTex[this.thread.z][this.thread.y][this.thread.x];
    }, {...this.pipelineFuncSettings, argumentTypes: {framebufTex: 'Array3D(3)'}});
    
    this.copyFramebufferFuncImmutable = this.gpu.createKernel(function(framebufTex) {
      return framebufTex[this.thread.z][this.thread.y][this.thread.x];
    }, {...this.pipelineFuncSettings, immutable: true, argumentTypes: {framebufTex: 'Array3D(3)'}});
    
    this.combineFramebuffersAlphaOneMinusAlphaFunc = this.gpu.createKernel(function(fb1Tex, fb2Tex, alpha, oneMinusAlpha) {
      const fb1Voxel = fb1Tex[this.thread.z][this.thread.y][this.thread.x];
      const fb2Voxel = fb2Tex[this.thread.z][this.thread.y][this.thread.x];
      return [
        alpha*fb1Voxel[0] + oneMinusAlpha*fb2Voxel[0],
        alpha*fb1Voxel[1] + oneMinusAlpha*fb2Voxel[1],
        alpha*fb1Voxel[2] + oneMinusAlpha*fb2Voxel[2]
      ];
    }, {...this.pipelineFuncSettings, argumentTypes: {fb1Tex: 'Array3D(3)', fb2Tex: 'Array3D(3)', alpha: 'Float', oneMinusAlpha: 'Float'}});

    // Animation-specific Kernels
    /*
    this.boxFillMaskFunc = this.gpu.createKernel(function(minPt, maxPt) {
      const currVoxelPos = [this.thread.z, this.thread.y, this.thread.x];
      return (currVoxelPos[0] > minPt[0] && currVoxelPos[0] < maxPt[0] &&
              currVoxelPos[1] > minPt[1] && currVoxelPos[1] < maxPt[1] &&
              currVoxelPos[2] > minPt[2] && currVoxelPos[2] < maxPt[2]) 
          ? [1.0, 1.0, 1.0] : [0.0, 0.0, 0.0];
    }, this.pipelineFuncSettings);
    this.boxOutlineMaskFunc = this.gpu.createKernel(function(minPt, maxPt) {
      const currVoxelPos = [this.thread.z, this.thread.y, this.thread.x];
      // Is the voxel within the outer boundary voxels of the box?
      const dx = Math.max(Math.max(minPt[0] - currVoxelPos[0], 0), currVoxelPos[0] - maxPt[0]);
      const dy = Math.max(Math.max(minPt[1] - currVoxelPos[1], 0), currVoxelPos[1] - maxPt[1]);
      const dz = Math.max(Math.max(minPt[2] - currVoxelPos[2], 0), currVoxelPos[2] - maxPt[2]);
      const sqrDist = dx*dx + dy*dy + dz*dz;
      return (sqrDist < this.constants.VOXEL_ERR_UNITS_SQR) ? [1.0, 1.0, 1.0] : [0.0, 0.0, 0.0];
    }, this.pipelineFuncSettings);
    this.sphereOutlineMaskFunc = this.gpu.createKernel(function(c, rSqr) {
      // Check whether the voxel is on the outside-ish of the sphere
      const currVoxelPos = [this.thread.z, this.thread.y, this.thread.x];
      // Find the squared distance from the center of the sphere to the voxel
      const sqrDist = Math.pow(currVoxelPos[0]-c[0],2) + Math.pow(currVoxelPos[1]-c[1],2) + Math.pow(currVoxelPos[2]-c[2],2);
      return Math.abs(rSqr-sqrDist) <= this.constants.VOXEL_ERR_UNITS_SQR ?  [1.0, 1.0, 1.0]  : [0.0, 0.0, 0.0];
    }, this.pipelineFuncSettings);
    this.overwriteMaskedColourFuncImmutable = this.gpu.createKernel(function(framebufTex, maskTex, colour) {
      const originalVoxel = framebufTex[this.thread.z][this.thread.y][this.thread.x];
      const maskVoxel  = maskTex[this.thread.z][this.thread.y][this.thread.x];
      return maskVoxel[0] <= 0 ? [originalVoxel[0], originalVoxel[1], originalVoxel[2]] : [colour[0], colour[1], colour[2]];
    }, {...this.pipelineFuncSettings, immutable: true, argumentTypes: {framebufTex: 'Array3D(3)', maskTex: 'Array3D(3)', colour: 'Array(3)'}});
    */

    const shapesDrawSettings = {...this.pipelineFuncSettings, 
      argumentTypes: {
        framebufTex: 'Array3D(3)', c: 'Array(3)', radiiSqr: 'Array', colours: 'Array1D(3)', brightness: 'Float', numSpheres: 'Integer'
      }
    }
    this.spheresFillOverwrite = this.gpu.createKernel(function(framebufTex, c, radiiSqr, colours, brightness) {
      // Find the squared distance from the center of the sphere to the voxel
      const currVoxelPos = [this.thread.z, this.thread.y, this.thread.x];
      const framebufColour = framebufTex[this.thread.z][this.thread.y][this.thread.x];
      const sqrDist = Math.pow(currVoxelPos[0]-c[0],2) + Math.pow(currVoxelPos[1]-c[1],2) + Math.pow(currVoxelPos[2]-c[2],2);
      
      // Check each radius to see which one the voxel is inside last
      for (let i = 0; i < this.constants.gridSize; i++) {
        if (sqrDist <= (radiiSqr[i] + this.constants.VOXEL_ERR_UNITS_SQR)) {
          const currColour = colours[i];
          return [brightness*currColour[0], brightness*currColour[1], brightness*currColour[2]];
        }
      }
      return [framebufColour[0], framebufColour[1], framebufColour[2]];
    }, shapesDrawSettings);

    this.cubesFillOverwrite = this.gpu.createKernel(function(framebufTex, c, radii, colours, brightness) {
      // Find the squared distance from the center of the sphere to the voxel
      const currVoxelPos = [this.thread.z, this.thread.y, this.thread.x];
      const framebufColour = framebufTex[this.thread.z][this.thread.y][this.thread.x];

      // Check each radius to see which one the voxel is inside last
      for (let i = 0; i < this.constants.gridSize; i++) {
        const radius = radii[i];
        const minPt = [c[0]-radius, c[1]-radius, c[2]-radius];
        const maxPt = [c[0]+radius, c[1]+radius, c[2]+radius];
        if (currVoxelPos[0] > minPt[0] && currVoxelPos[0] < maxPt[0] &&
            currVoxelPos[1] > minPt[1] && currVoxelPos[1] < maxPt[1] &&
            currVoxelPos[2] > minPt[2] && currVoxelPos[2] < maxPt[2]) {

          const currColour = colours[i];
          return [brightness*currColour[0], brightness*currColour[1], brightness*currColour[2]];
        }
      }
      return [framebufColour[0], framebufColour[1], framebufColour[2]];
    }, shapesDrawSettings);

    const fireLookupSettings = {
      output: [FIRE_SPECTRUM_WIDTH],
      pipeline: false,
      immutable: false,
      constants: {
        FIRE_THRESHOLD: 7,
        MAX_FIRE_ALPHA: 1.0,
        FULL_ON_FIRE: 100,
      },
      returnType: 'Array(4)',
      argumentTypes: {spectrum: 'Array1D(4)'}
    };
    this.fireLookupGen = this.gpu.createKernel(function(spectrum) {
      const idx = this.thread.x;
      const result = [0,0,0,0];
      if (idx >= this.constants.FIRE_THRESHOLD) {
        const currSpectrumVal = spectrum[idx];
        result[0] = currSpectrumVal[0];
        result[1] = currSpectrumVal[1];
        result[2] = currSpectrumVal[2];
        result[3] = this.constants.MAX_FIRE_ALPHA * ((idx > this.constants.FULL_ON_FIRE) ? 1.0 : (idx - this.constants.FIRE_THRESHOLD)/(this.constants.FULL_ON_FIRE - this.constants.FIRE_THRESHOLD));
      }
      return result;
    }, fireLookupSettings);

    this.fireOverwrite = this.gpu.createKernel(function(fireLookup, temperatureArr, offsetXYZ) {
      const temperature = temperatureArr[this.thread.z + offsetXYZ[2]][this.thread.y + offsetXYZ[1]][this.thread.x + offsetXYZ[0]];
      const temperatureIdx = clampValue(Math.round(temperature*(this.constants.FIRE_SPECTRUM_WIDTH-1)), 0, this.constants.FIRE_SPECTRUM_WIDTH-1);
      const voxelColour = fireLookup[temperatureIdx];
      return [
        clampValue(voxelColour[3]*voxelColour[0], 0, 1), 
        clampValue(voxelColour[3]*voxelColour[1], 0, 1), 
        clampValue(voxelColour[3]*voxelColour[2], 0, 1)
      ];
    }, 
    {...this.pipelineFuncSettings, 
      argumentTypes: {
        fireLookupTex: 'Array1D(4)', 
        temperatureArr: 'Array', 
        offsetXYZ: 'Array'
      },
      constants: {...this.pipelineFuncSettings.constants,
        FIRE_SPECTRUM_WIDTH: FIRE_SPECTRUM_WIDTH,
      }
    });

  }

  initFireKernels(N) {
    if (this._fluidKernelsInit) { return; }

    const NPLUS2 = N+2;
    const pipelineFuncSettings = {
      output: [NPLUS2, NPLUS2, NPLUS2],
      pipeline: true,
      constants: {
        N: N,
        NPLUSAHALF: N+0.5,
        ONEDIVN: 1.0/N,
        BOUNDARY: 0.9,
      },
      immutable: true,
    };
    this.gpu.addFunction(function ijkLookup() {
      return [this.thread.z, this.thread.y, this.thread.x];
    });

    const ARRAY3D_TYPE = 'Array';
    const ARRAY3D_3_TYPE = 'Array3D(3)';
    this.initFluidBufferFunc = this.gpu.createKernel(function(value) {
      return value;
    }, {...pipelineFuncSettings, argumentTypes: {value: 'Float'}});
    this.initFluidBuffer3Func = this.gpu.createKernel(function(x,y,z) {
      return [x, y, z];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {x: 'Float', y: 'Float', z: 'Float'}});

    this.addFluidSourceFunc = this.gpu.createKernel(function(srcBuffer, dstBuffer, dt) {
      const [i,j,k] = ijkLookup();
      return dstBuffer[i][j][k] + srcBuffer[i][j][k] * dt;
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {srcBuffer: ARRAY3D_TYPE, dstBuffer: ARRAY3D_TYPE, dt: 'Float'}});

    this.addBuoyancyFunc = this.gpu.createKernel(function(T, uvw, dtBuoy) {
      const [i,j,k] = ijkLookup();
      const uvwVec = uvw[i][j][k];
      return [uvwVec[0], uvwVec[1]  + T[i][j][k] * dtBuoy, uvwVec[2]];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {T: ARRAY3D_TYPE, uvw: ARRAY3D_3_TYPE, dtBuoy: 'Float'}});

    this.diffuseStepFunc = this.gpu.createKernel(function (x0, x, a, boundaryBuf) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 || i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return x[i][j][k];
      }
      const xiNeg = boundaryBuf[i-1][j][k] > this.constants.BOUNDARY ? x[i][j][k] : x[i-1][j][k];
      const xiPos = boundaryBuf[i+1][j][k] > this.constants.BOUNDARY ? x[i][j][k] : x[i+1][j][k];
      const xjNeg = boundaryBuf[i][j-1][k] > this.constants.BOUNDARY ? x[i][j][k] : x[i][j-1][k];
      const xjPos = boundaryBuf[i][j+1][k] > this.constants.BOUNDARY ? x[i][j][k] : x[i][j+1][k];
      const xkNeg = boundaryBuf[i][j][k-1] > this.constants.BOUNDARY ? x[i][j][k] : x[i][j][k-1];
      const xkPos = boundaryBuf[i][j][k+1] > this.constants.BOUNDARY ? x[i][j][k] : x[i][j][k+1];

      return (x0[i][j][k] + a * (xiNeg + xiPos + xjNeg + xjPos + xkNeg + xkPos)) / (1+6*a);
    }, {...pipelineFuncSettings, returnType: 'Float', 
      argumentTypes: {
        x0: ARRAY3D_TYPE, x: ARRAY3D_TYPE, a: 'Float', boundaryBuf: ARRAY3D_TYPE
      }
    });

    this.diffuseStep3Func = this.gpu.createKernel(function (uvw0, uvw, a, boundaryBuf) {
      const [i,j,k] = ijkLookup();
      const uvwijk = uvw[i][j][k];
      if (i < 1 || j < 1 || k < 1 || i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvwijk;
      }
      const divisor = 1.0 + 6.0*a;
      const uvw0ijk = uvw0[i][j][k];
      const uvwiNeg = boundaryBuf[i-1][j][k] > this.constants.BOUNDARY ? uvwijk : uvw[i-1][j][k];
      const uvwiPos = boundaryBuf[i+1][j][k] > this.constants.BOUNDARY ? uvwijk : uvw[i+1][j][k];
      const uvwjNeg = boundaryBuf[i][j-1][k] > this.constants.BOUNDARY ? uvwijk : uvw[i][j-1][k];
      const uvwjPos = boundaryBuf[i][j+1][k] > this.constants.BOUNDARY ? uvwijk : uvw[i][j+1][k];
      const uvwkNeg = boundaryBuf[i][j][k-1] > this.constants.BOUNDARY ? uvwijk : uvw[i][j][k-1];
      const uvwkPos = boundaryBuf[i][j][k+1] > this.constants.BOUNDARY ? uvwijk : uvw[i][j][k+1];

      return [
        (uvw0ijk[0] + a*(uvwiNeg[0] + uvwiPos[0] + uvwjNeg[0] + uvwjPos[0] + uvwkNeg[0] + uvwkPos[0])) / divisor,
        (uvw0ijk[1] + a*(uvwiNeg[1] + uvwiPos[1] + uvwjNeg[1] + uvwjPos[1] + uvwkNeg[1] + uvwkPos[1])) / divisor,
        (uvw0ijk[2] + a*(uvwiNeg[2] + uvwiPos[2] + uvwjNeg[2] + uvwjPos[2] + uvwkNeg[2] + uvwkPos[2])) / divisor
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', 
      argumentTypes: {
        uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE, a: 'Float', boundaryBuf: ARRAY3D_TYPE
      }
    });
    
    this.advectCoolFunc = this.gpu.createKernel(function (x0, x, uuvvww, dt0, c0, boundaryBuf) {
      const [i,j,k] = ijkLookup();
      if (boundaryBuf[i][j][k] > this.constants.BOUNDARY) {
        return 0;
      }
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return x[i][j][k];
      }
      const uvwijk = uuvvww[i][j][k];
      let xx = clampValue(i-dt0*uvwijk[0], 0.5, this.constants.NPLUSAHALF);
      let yy = clampValue(j-dt0*uvwijk[1], 0.5, this.constants.NPLUSAHALF);
      let zz = clampValue(k-dt0*uvwijk[2], 0.5, this.constants.NPLUSAHALF);
      let i0 = Math.floor(xx); let i1 = i0 + 1;
      let j0 = Math.floor(yy); let j1 = j0 + 1;
      let k0 = Math.floor(zz); let k1 = k0 + 1;
      let sx1 = xx-i0; let sx0 = 1-sx1;
      let sy1 = yy-j0; let sy0 = 1-sy1;
      let sz1 = zz-k0; let sz0 = 1-sz1;
      let v0 = sx0*(sy0*x0[i0][j0][k0] + sy1*x0[i0][j1][k0]) + sx1*(sy0*x0[i1][j0][k0] + sy1*x0[i1][j1][k0]);
      let v1 = sx0*(sy0*x0[i0][j0][k1] + sy1*x0[i0][j1][k1]) + sx1*(sy0*x0[i1][j0][k1] + sy1*x0[i1][j1][k1]);
      return (sz0*v0 + sz1*v1)*c0;
    }, {...pipelineFuncSettings, returnType: 'Float', 
        argumentTypes: { 
          x0: ARRAY3D_TYPE, x: ARRAY3D_TYPE, uuvvww: ARRAY3D_3_TYPE, 
          dt0: 'Float', c0: 'Float', boundaryBuf: ARRAY3D_TYPE
        }
    });

    this.advectCool3Func = this.gpu.createKernel(function(uvw0, uvw, dt0, boundaryBuf) {
      const [i,j,k] = ijkLookup();
      if (boundaryBuf[i][j][k] > this.constants.BOUNDARY) {
        return [0,0,0];
      }
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvw[i][j][k];
      }

      const uvw0ijk = uvw0[i][j][k];
      const xx = clampValue(i-dt0*uvw0ijk[0], 0.5, this.constants.NPLUSAHALF);
      const yy = clampValue(j-dt0*uvw0ijk[1], 0.5, this.constants.NPLUSAHALF);
      const zz = clampValue(k-dt0*uvw0ijk[2], 0.5, this.constants.NPLUSAHALF);
      const i0 = Math.floor(xx); const i1 = i0 + 1;
      const j0 = Math.floor(yy); let j1 = j0 + 1;
      const k0 = Math.floor(zz); let k1 = k0 + 1;
      const sx1 = xx-i0; const sx0 = 1-sx1;
      const sy1 = yy-j0; const sy0 = 1-sy1;
      const sz1 = zz-k0; const sz0 = 1-sz1;

      const uvw0i0j0k0 = uvw0[i0][j0][k0];
      const uvw0i0j1k0 = uvw0[i0][j1][k0];
      const uvw0i1j0k0 = uvw0[i1][j0][k0];
      const uvw0i1j1k0 = uvw0[i1][j1][k0];
      const uvw0i0j0k1 = uvw0[i0][j0][k1];
      const uvw0i0j1k1 = uvw0[i0][j1][k1];
      const uvw0i1j0k1 = uvw0[i1][j0][k1];
      const uvw0i1j1k1 = uvw0[i1][j1][k1];

      const result = [0,0,0];
      for (let i = 0; i < 3; i++) {
        let v0 = sx0*(sy0*uvw0i0j0k0[i] + sy1*uvw0i0j1k0[i]) + sx1*(sy0*uvw0i1j0k0[i] + sy1*uvw0i1j1k0[i]);
        let v1 = sx0*(sy0*uvw0i0j0k1[i] + sy1*uvw0i0j1k1[i]) + sx1*(sy0*uvw0i1j0k1[i] + sy1*uvw0i1j1k1[i]);
        result[i] = sz0*v0 + sz1*v1;
      }
      return result;
    }, {...pipelineFuncSettings, returnType: 'Array(3)', 
        argumentTypes: { uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE, dt0: 'Float', boundaryBuf: ARRAY3D_TYPE}});

    this.projectStep1Func = this.gpu.createKernel(function(uvw0, uvw) {
      const [i,j,k] = ijkLookup();
      const uvw0ijk = uvw0[i][j][k];
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvw0ijk;
      }
      const uvwiPos = uvw[i+1][j][k];
      const uvwiNeg = uvw[i-1][j][k];
      const uvwjPos = uvw[i][j+1][k];
      const uvwjNeg = uvw[i][j-1][k];
      const uvwkPos = uvw[i][j][k+1];
      const uvwkNeg = uvw[i][j][k-1];
      return [
        0,
        -this.constants.ONEDIVN * (uvwiPos[0] - uvwiNeg[0] + uvwjPos[1] - uvwjNeg[1] + uvwkPos[2] - uvwkNeg[2]) / 3.0,
        uvw0ijk[2]
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE}});

    this.projectStep2Func = this.gpu.createKernel(function(uvw0) {
      const [i,j,k] = ijkLookup();
      const uvw0ijk = uvw0[i][j][k];
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvw0ijk;
      }

      const uvw0iNeg = uvw0[i-1][j][k];
      const uvw0iPos = uvw0[i+1][j][k];
      const uvw0jNeg = uvw0[i][j-1][k];
      const uvw0jPos = uvw0[i][j+1][k];
      const uvw0kNeg = uvw0[i][j][k-1];
      const uvw0kPos = uvw0[i][j][k+1];

      return [
        (uvw0ijk[1] + uvw0iNeg[0] + uvw0iPos[0] + uvw0jNeg[0] + uvw0jPos[0] + uvw0kNeg[0] + uvw0kPos[0]) / 6.0,
        uvw0ijk[1],
        uvw0ijk[2]
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE}});

    this.projectStep3Func = this.gpu.createKernel(function(uvw, uvw0, boundaryBuf) {
      const [i,j,k] = ijkLookup();
      const uvwijk = uvw[i][j][k];
      const obstVel = [0,0,0];
      const velMask = [1,1,1];

      let uvw0iNeg = [0,0,0];
      if (i < 1 || boundaryBuf[i-1][j][k] > this.constants.BOUNDARY) {uvw0iNeg = uvwijk; obstVel[0] = 0; velMask[0] = 0;} 
      else { uvw0iNeg = uvw0[i-1][j][k]; }

      let uvw0iPos = [0,0,0];
      if (i > this.constants.N || boundaryBuf[i+1][j][k] > this.constants.BOUNDARY) {uvw0iPos = uvwijk; obstVel[0] = 0; velMask[0] = 0;}
      else {uvw0iPos = uvw0[i+1][j][k];}

      let uvw0jNeg = [0,0,0];
      if (j < 1 || boundaryBuf[i][j-1][k] > this.constants.BOUNDARY) {uvw0jNeg = uvwijk; obstVel[1] = 0; velMask[1] = 0;}
      else {uvw0jNeg = uvw0[i][j-1][k];}

      let uvw0jPos = [0,0,0];
      if (j > this.constants.N || boundaryBuf[i][j+1][k] > this.constants.BOUNDARY) {uvw0jPos = uvwijk; obstVel[1] = 0; velMask[1] = 0;}
      else { uvw0jPos = uvw0[i][j+1][k]; }

      let uvw0kNeg = [0,0,0];
      if (k < 1 || boundaryBuf[i][j][k-1] > this.constants.BOUNDARY) {uvw0kNeg = uvwijk; obstVel[2] = 0; velMask[2] = 0;}
      else {uvw0kNeg = uvw0[i][j][k-1];}

      let uvw0kPos = [0,0,0];
      if (k > this.constants.N || boundaryBuf[i][j][k+1] > this.constants.BOUNDARY) {uvw0kPos = uvwijk; obstVel[2] = 0; velMask[2] = 0;}
      else {uvw0kPos = uvw0[i][j][k+1];}

      const vNew = [
        uvwijk[0] - (uvw0iPos[0] - uvw0iNeg[0]) / 3.0 / this.constants.ONEDIVN,
        uvwijk[1] - (uvw0jPos[0] - uvw0jNeg[0]) / 3.0 / this.constants.ONEDIVN,
        uvwijk[2] - (uvw0kPos[0] - uvw0kNeg[0]) / 3.0 / this.constants.ONEDIVN
      ];

      return [
        (velMask[0] * vNew[0]) + obstVel[0],
        (velMask[1] * vNew[1]) + obstVel[1],
        (velMask[2] * vNew[2]) + obstVel[2],
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', 
      argumentTypes: {
        uvw: ARRAY3D_3_TYPE, uvw0: ARRAY3D_3_TYPE, boundaryBuf: ARRAY3D_TYPE
      }
    });

    this.curlFunc = this.gpu.createKernel(function(curlxyz, uvw) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return curlxyz[i][j][k];
      }

      const uvwiPos = uvw[i+1][j][k];
      const uvwiNeg = uvw[i-1][j][k];
      const uvwjPos = uvw[i][j+1][k];
      const uvwjNeg = uvw[i][j-1][k];
      const uvwkPos = uvw[i][j][k+1];
      const uvwkNeg = uvw[i][j][k-1];
      
      return [
        (uvwjPos[2] - uvwjNeg[2]) * 0.5 - (uvwkPos[1] - uvwkNeg[1]) * 0.5,
        (uvwkPos[0] - uvwkNeg[0]) * 0.5 - (uvwiPos[2] - uvwiNeg[2]) * 0.5,
        (uvwiPos[1] - uvwiNeg[1]) * 0.5 - (uvwjPos[0] - uvwjNeg[0]) * 0.5
      ];
    },  {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {curlxyz: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE}});

    this.vorticityConfinementStep1Func = this.gpu.createKernel(function(curl, curlxyz) {
      const [i,j,k] = ijkLookup();
      const curlxyzijk = curlxyz[i][j][k];
      const x = curlxyzijk[0];
      const y = curlxyzijk[1];
      const z = curlxyzijk[2];
      return Math.sqrt(x*x + y*y + z*z);
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {curl: ARRAY3D_TYPE, curlxyz: ARRAY3D_3_TYPE}});
  
    this.vorticityConfinementStep2Func = this.gpu.createKernel(function(uvw, T0, curlxyz, dt0) {
      const [i,j,k] = ijkLookup();
      const uvwVal  = uvw[i][j][k];
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvwVal;
      }

      let Nx = (T0[i+1][j][k] - T0[i-1][j][k]) * 0.5;
      let Ny = (T0[i][j+1][k] - T0[i][j-1][k]) * 0.5;
      let Nz = (T0[i][j][k+1] - T0[i][j][k-1]) * 0.5;
      const len1 = 1.0 / (Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz) + 0.0000001);
      Nx *= len1; Ny *= len1; Nz *= len1;

      const curlVal = curlxyz[i][j][k];
      return [
        uvwVal[0] + (Ny*curlVal[2] - Nz*curlVal[1]) * dt0,
        uvwVal[1] + (Nz*curlVal[0] - Nx*curlVal[2]) * dt0,
        uvwVal[2] + (Nx*curlVal[1] - Ny*curlVal[0]) * dt0
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw: ARRAY3D_3_TYPE, T0: ARRAY3D_TYPE, curlxyz: ARRAY3D_3_TYPE, dt0: 'Float'}});

    this._fluidKernelsInit = true;
  }

  initBarVisualizerKernels(gridSize, numStaticAudioLevels) {
    if (this._barVisKernelsInit) { return; }

    const halfGridSize = gridSize/2;
    const sqrtNumAudioLevels = Math.sqrt(numStaticAudioLevels);
    const barVisFuncSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true,
      immutable: false,
      returnType: 'Array(4)',
      constants: {
        TWOPI: 2*Math.PI,
        numAudioLevels: numStaticAudioLevels,
        sqrtNumAudioLevels: sqrtNumAudioLevels,
        chunkSize: gridSize/sqrtNumAudioLevels,
        gridSize: gridSize,
        halfGridSize: halfGridSize,
        halfGridSizeIdx: (gridSize-1)/2,
        gridSizeSqr: gridSize*gridSize,
        totalNumTieredSlots: 4*(halfGridSize*halfGridSize + 2*halfGridSize + 1),
      },
    };

    this.initBarVisualizerBuffer3Func = this.gpu.createKernel(function(valueX, valueY, valueZ, valueW) {
      return [valueX, valueY, valueZ, valueW];
    }, {...barVisFuncSettings, immutable: true, argumentTypes: {valueX: 'Float', valueY: 'Float', valueZ: 'Float', valueW: 'Float'}});

    this.gpu.addFunction(function calcAudioCutoff(audioIntensity, levelMax, height) {
      return (Math.log10(audioIntensity) / levelMax) * height;
    });
    this.gpu.addFunction(function barVisCutoff(audioLevels, levelMax, height) {
      //const levelIdx = Math.floor((this.constants.numAudioLevels / this.constants.gridSizeSqr) * (this.thread.z*this.constants.gridSize + this.thread.x));
      const levelIdx  = this.constants.sqrtNumAudioLevels*Math.floor(this.thread.z/this.constants.chunkSize) +  Math.floor(this.thread.x/this.constants.chunkSize);
      return calcAudioCutoff(audioLevels[levelIdx], levelMax, height);
    });
    this.gpu.addFunction(function barVisCutoffCentered(audioLevels, levelMax, height) {

      // How far from the center are we? Project the current vector from the center onto the x or z axis...
      const diffX = this.constants.halfGridSizeIdx-this.thread.x;
      const diffZ = this.constants.halfGridSizeIdx-this.thread.z;
      const lengthDiffXZ = Math.max(Math.sqrt(diffX*diffX + diffZ*diffZ), 0.000001);
      const nDiffX = diffX/lengthDiffXZ;
      const nDiffZ = diffZ/lengthDiffXZ;
      
      // There are this.constants.halfGridSize tiers, each tier has an increasing number of bars as you move out from the center
      const projectedTierIdx = Math.floor(Math.max(Math.abs(diffX), Math.abs(diffZ)));

      // Calculate the index lookup into the audiolevels based on how far out from the
      // center we are (i.e., which tier we're in), combined with the distribution of levels around the center
      const numSlotsAtTier = 8*projectedTierIdx + 4;
      // Divide 2pi by the number of slots at this tier and then find out where in the circle we land with
      // the current point - that will be in the index of the slot within this tier
      const radiansPerSlot = this.constants.TWOPI/numSlotsAtTier;
      // NOTE: Math.sign(-nDiffZ) is the sign of the cross product Y component when crossing with the (x,z) = (1,0) vector
      const radiansFromX = (Math.acos(nDiffX)*Math.sign(nDiffZ) + this.constants.TWOPI) % this.constants.TWOPI;
      const tierSlotIdx = Math.floor(radiansFromX / radiansPerSlot);
      const projectedTierIdxMinus1 = projectedTierIdx-1;
      const numLevelsPerSlot = this.constants.numAudioLevels / this.constants.totalNumTieredSlots;
      const levelIdx = Math.floor((4*(projectedTierIdxMinus1*projectedTierIdxMinus1 + 2*projectedTierIdxMinus1 + 1) + tierSlotIdx) * numLevelsPerSlot);
      return calcAudioCutoff(audioLevels[levelIdx], levelMax, height);
    });
    this.gpu.addFunction(function drawBarVis(prevVisTex, levelColours, cutoff, cutoffClampSize, fadeFactor, dt, yIdx, glowMultiplier) {
      const prevVoxelRGBA = prevVisTex[this.thread.z][this.thread.y][this.thread.x];
      const fadeFactorAdjusted = Math.pow(fadeFactor, dt);
      const clampedCutoff = clampValue(cutoff, 0, cutoffClampSize);
      const isVisible = yIdx < clampedCutoff ? 1.0 : 0.0;

      // Allow bars to fade over time, make especially high intensity bars glow white
      const alpha = (prevVoxelRGBA[3] * fadeFactorAdjusted + isVisible * (prevVoxelRGBA[3]*glowMultiplier*Math.max(cutoff-cutoffClampSize, 0) + 1 - fadeFactorAdjusted));
      return [
        levelColours[yIdx][0],
        levelColours[yIdx][1],
        levelColours[yIdx][2], alpha
      ];
    });

    const barVisArgs = {audioLevels: 'Array', levelMax: 'Float', fadeFactor: 'Float', levelColours: 'Array', prevVisTex: 'Array3D(4)', dt: 'Float'};

    this.staticBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoff(audioLevels, levelMax, this.constants.gridSize);
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.gridSize, fadeFactor, dt, this.thread.y, 0.02);
    }, {...barVisFuncSettings, immutable: true, argumentTypes: barVisArgs});

    this.staticSplitLevelBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoff(audioLevels, levelMax, this.constants.halfGridSize);
      const yIndex = Math.floor(Math.abs(this.thread.y + 1 - this.constants.halfGridSize));
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.halfGridSize, fadeFactor, dt, yIndex, 0.02);
    }, {...barVisFuncSettings, immutable: true, argumentTypes: barVisArgs});

    this.staticCenteredBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoffCentered(audioLevels, levelMax, this.constants.gridSize);
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.gridSize, fadeFactor, dt, this.thread.y, 0.01);
    }, {...barVisFuncSettings, immutable: true, argumentTypes: barVisArgs});

    this.staticCenteredSplitLevelBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoffCentered(audioLevels, levelMax, this.constants.halfGridSize);
      const yIndex = Math.floor(Math.abs(this.thread.y + 1 - this.constants.halfGridSize));
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.halfGridSize, fadeFactor, dt, yIndex, 0.01);
    }, {...barVisFuncSettings, immutable: true, argumentTypes: barVisArgs});


    const historyBarVisArgs = {audioHistoryLevels: 'Array', directionVec: 'Array', levelMax: 'Float', fadeFactor: 'Float', levelColours: 'Array', prevVisTex: 'Array3D(4)', dt: 'Float'};
    this.historyBarVisFunc = this.gpu.createKernel(function(audioHistoryLevels, directionVec, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      // The audioHistoryLevels is 2D history buffer - depending on the given direction we may have to reverse how we look-up into it
      let historyIdx = Math.floor(directionVec[0]*this.thread.z + directionVec[1]*this.thread.x);
      let levelIdx = Math.floor(directionVec[1]*this.thread.z + directionVec[0]*this.thread.x);
      if (Math.sign(directionVec[0]+directionVec[1]) < 0) {
        historyIdx = this.constants.gridSize-1 + historyIdx;
        levelIdx = this.constants.gridSize-1 + levelIdx;
      }

      const cutoff = calcAudioCutoff(audioHistoryLevels[historyIdx][levelIdx], levelMax, this.constants.gridSize);
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.gridSize, fadeFactor, dt, this.thread.y, 0.02);
    }, {...barVisFuncSettings, immutable: true, argumentTypes: historyBarVisArgs});

    this.renderBarVisualizerAlphaFunc = this.gpu.createKernel(function(barVisTex) {
      const currVoxel = barVisTex[this.thread.z][this.thread.y][this.thread.x];
      return [
        clampValue(currVoxel[0]*currVoxel[3], 0, 1), 
        clampValue(currVoxel[1]*currVoxel[3], 0, 1), 
        clampValue(currVoxel[2]*currVoxel[3], 0, 1)
      ];
    }, {...barVisFuncSettings, returnType: 'Array(3)', argumentTypes: {barVisTex: 'Array3D(4)'}});

    this._barVisKernelsInit = true;
  }

}

export default GPUKernelManager;