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
        gridSizex2: 2*gridSize,
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
      for (let i = 0; i < this.constants.gridSizex2; i++) {
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
      argumentTypes: { fireLookupTex: 'Array1D(4)', temperatureArr: 'Array', offsetXYZ: 'Array'},
      constants: {...this.pipelineFuncSettings.constants, FIRE_SPECTRUM_WIDTH: FIRE_SPECTRUM_WIDTH}
    });

    this.waterOverwrite = this.gpu.createKernel(function(waterLookup, airLookup, levelSet, levelEpsilon, offsetXYZ) {
      // The water level is negative if in water, 0 at boundary, and positive outside of the water
      const waterLevel = levelSet[this.thread.z + offsetXYZ[2]][this.thread.y + offsetXYZ[1]][this.thread.x + offsetXYZ[0]];
      const idx = clampValue(Math.floor(Math.abs(waterLevel)), 0, this.constants.halfGridSize);
      const voxelColour =  waterLevel > levelEpsilon ? airLookup[idx] : waterLookup[idx];
      return [voxelColour[0], voxelColour[1], voxelColour[2]];

    }, {...this.pipelineFuncSettings,
      argumentTypes: { waterLookup: 'Array1D(4)', airLookup: 'Array1D(4)', levelSet: 'Array', levelEpsilon: 'Float', offsetXYZ: 'Array'},
    });
  }

  initFluidKernels(N) {
    if (this._fluidKernelsInit) { return; }

    const NPLUS2 = N+2;
    const pipelineFuncSettings = {
      output: [NPLUS2, NPLUS2, NPLUS2],
      pipeline: true,
      constants: {N: N},
      immutable: true,
    };
    this.initFluidBufferFunc = this.gpu.createKernel(function(value) {
      return value;
    }, {...pipelineFuncSettings, argumentTypes: {value: 'Float'}});
    this.initFluidBuffer3Func = this.gpu.createKernel(function(x,y,z) {
      return [x, y, z];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {x: 'Float', y: 'Float', z: 'Float'}});
    
    this._fluidKernelsInit = true;
  }

  initFireKernels(N) {
    if (this._fireKernelsInit) { return; }

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

    this.advect3Func = this.gpu.createKernel(function(uvw0, uvw, dt0, boundaryBuf) {
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

      // NOTE: uvw0ijk[1] contains the value calculated in step 1
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

    this.vorticityConfinementStep1Func = this.gpu.createKernel(function(curlxyz) {
      const [i,j,k] = ijkLookup();
      const curlxyzijk = curlxyz[i][j][k];
      const x = curlxyzijk[0];
      const y = curlxyzijk[1];
      const z = curlxyzijk[2];
      return Math.sqrt(x*x + y*y + z*z);
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {curlxyz: ARRAY3D_3_TYPE}});
  
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

    this._fireKernelsInit = true;
  }

  initLiquidKernels(N) {
    if (this._liquidKernelsInit) { return; }

    const NPLUS2 = N+2;
    const pipelineFuncSettings = {
      output: [NPLUS2, NPLUS2, NPLUS2],
      pipeline: true,
      constants: { N: N, NDIV2: N/2, NPLUS1: N+1, NPLUSAHALF: N+0.5, ONEDIVN: 1.0/N, BOUNDARY: 0.9 },
      immutable: true,
    };
    this.gpu.addFunction(function xyzLookup() {
      return [this.thread.z, this.thread.y, this.thread.x];
    });
    this.gpu.addFunction(function clampm1(c) {
      return Math.max(c-1, 0);
    });
    this.gpu.addFunction(function clampm2(c) {
      return Math.max(c-2, 0);
    });
    this.gpu.addFunction(function clampp1(c) {
      return Math.min(c+1, this.constants.NPLUS1);
    });
    this.gpu.addFunction(function clampp2(c) {
      return Math.min(c+2, this.constants.NPLUS1);
    });
    
    this.gpu.addFunction(function length3(vec) {
      return Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1] + vec[2]*vec[2]);
    });
    this.gpu.addFunction(function normalize3(vec) {
      const len = length3(vec) + 0.0001;
      return [vec[0]/len, vec[1]/len, vec[2]/len];
    });
    this.gpu.addFunction(function lerp(x, x0, x1, y0, y1) {
      return y0 + (x-x0) * ((y1-y0) / (x1 - x0 + 0.00001));
    });
    this.gpu.addFunction(function minmod(a,b) {
      return ((a*b < 0) ? 0 : ((Math.abs(a) < Math.abs(b)) ? a : b));
    });
    this.gpu.addFunction(function godunovH(sgn, a, b, c, d, e, f) {
      return Math.sqrt(sgn >= 0 ?
        (
          Math.max(Math.pow(Math.max(-a,0),2), Math.pow(Math.max(b,0),2)) +
          Math.max(Math.pow(Math.max(-c,0),2), Math.pow(Math.max(d,0),2)) +
          Math.max(Math.pow(Math.max(-e,0),2), Math.pow(Math.max(f,0),2))
        )
        :
        (
          Math.max(Math.pow(Math.max(a,0),2), Math.pow(Math.max(-b,0),2)) +
          Math.max(Math.pow(Math.max(c,0),2), Math.pow(Math.max(-d,0),2)) +
          Math.max(Math.pow(Math.max(e,0),2), Math.pow(Math.max(-f,0),2))
        )
      );
    });
    this.gpu.addFunction(function bilinearLookup(x,y,z,tex) {
      const xx = clampValue(x, 0.5, this.constants.NPLUSAHALF);
      const yy = clampValue(y, 0.5, this.constants.NPLUSAHALF);
      const zz = clampValue(z, 0.5, this.constants.NPLUSAHALF);
      const i0 = Math.floor(xx), i1 = i0 + 1;
      const j0 = Math.floor(yy), j1 = j0 + 1;
      const k0 = Math.floor(zz), k1 = k0 + 1;
      const sx1 = xx-i0, sx0 = 1-sx1;
      const sy1 = yy-j0, sy0 = 1-sy1;
      const sz1 = zz-k0, sz0 = 1-sz1;
      const ls0 = sx0*(sy0*tex[i0][j0][k0] + sy1*tex[i0][j1][k0]) + sx1*(sy0*tex[i1][j0][k0] + sy1*tex[i1][j1][k0]);
      const ls1 = sx0*(sy0*tex[i0][j0][k1] + sy1*tex[i0][j1][k1]) + sx1*(sy0*tex[i1][j0][k1] + sy1*tex[i1][j1][k1]);
      return (sz0*ls0 + sz1*ls1);
    });


    this.injectLiquidSphere = this.gpu.createKernel(function(center, radius, levelSet, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      const centerToLookup = [x-center[0], y-center[1], z-center[2]];
      const lsVal = length3(centerToLookup) - radius;
      const lsxyz = levelSet[x][y][z];
      return Math.abs(lsxyz) < Math.abs(lsVal) ? lsxyz : lsVal; // Output the level set value (negative in liquid, positive outside)
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      center: 'Array', radius: 'Float', levelSet: 'Array', boundaryBuf: 'Array'
    }});

    this.advectLevelSetBFECC = this.gpu.createKernel(function(dt, vel, barPhi, phiN, boundaryBuf, decay) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY) {
        return 0;
      }

      const u = vel[x][y][z];
      const nPos = [x-u[0]*dt, y-u[1]*dt, z-u[2]*dt];

      const diff = [
        Math.abs(this.constants.NDIV2 - x),
        Math.abs(this.constants.NDIV2 - y),
        Math.abs(this.constants.NDIV2 - z),
      ];

      // Must use regular semi-Lagrangian advection instead of BFECC at the volume boundaries
      const diffBoundaryMax = this.constants.NDIV2-4;
      let result = 0;
      if(diff[0] > diffBoundaryMax || diff[1] > diffBoundaryMax || diff[2] > diffBoundaryMax) {
        result = bilinearLookup(nPos[0], nPos[1], nPos[2], phiN);
      }
      else {
        result = 1.5 * bilinearLookup(nPos[0], nPos[1], nPos[2], phiN) - 
                 0.5 * bilinearLookup(nPos[0], nPos[1], nPos[2], barPhi);
      }

      return result * decay;
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      dt: 'Float', vel: 'Array3D(3)', barPhi: 'Array', phiN: 'Array', boundaryBuf: 'Array', decay: 'Float'
    }});

    this.advectLiquidLevelSet = this.gpu.createKernel(function(dt, vel, levelSet, boundaryBuf, forward, decay) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY) {
        return 0;
      }

      // Interpolate the new level set value bilinearly in the grid using the current cell's velocity
      // to backtrack to where we need to sample the levelset value
      //const dt0 = dt * this.constants.N;
      const u = vel[x][y][z];
      const du = [u[0]*dt*forward, u[1]*dt*forward,u[2]*dt*forward];
      return bilinearLookup(x-du[0], y-du[1], z-du[2], levelSet) * decay;
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      dt: 'Float', vel: 'Array3D(3)', levelSet: 'Array', boundaryBuf: 'Array', forward: 'Float', decay: 'Float'
    }});

    this.reinitLevelSet = this.gpu.createKernel(function(dt, levelSet0, levelSetN, boundaryBuf) {
      const [x,y,z] = xyzLookup();

      const ls0C = levelSet0[x][y][z];
      //if (boundaryBuf[x][y][z] > this.constants.BOUNDARY) {
      //  return ls0C;
      //}

      const xm1 = clampm1(x), xm2 = clampm2(x), xp1 = clampp1(x), xp2 = clampp2(x);
      const ym1 = clampm1(y), ym2 = clampm2(y), yp1 = clampp1(y), yp2 = clampp2(y);
      const zm1 = clampm1(z), zm2 = clampm2(z), zp1 = clampp1(z), zp2 = clampp2(z);

      // Calculate the Sign(levelSet0(x,y,z))
      const dx = 1, dy = 1, dz = 1;
      const dxSqr = dx*dx, dySqr = dy*dy, dzSqr = dz*dz;
      const sgnPhi0 = ls0C / Math.sqrt(ls0C*ls0C + dx*dx);

      // Calculate the gradient function for moving towards a steady-state where the signed distance
      // is properly reinitialized
      const lsNC = levelSetN[x][y][z];
      const lsNL = levelSetN[xm1][y][z], lsNR = levelSetN[xp1][y][z];
      const lsNB = levelSetN[x][ym1][z], lsNT = levelSetN[x][yp1][z];
      const lsND = levelSetN[x][y][zm1], lsNU = levelSetN[x][y][zp1];

      const DxxPhi    = ((lsNL - lsNC*2 + lsNR) / dxSqr);
      const DxxPhiPos = ((lsNC - lsNR*2 + levelSetN[xp2][y][z]) / dxSqr);
      const DxxPhiNeg = ((levelSetN[xm2][y][z] - lsNL*2 + lsNC) / dxSqr);
      const DyyPhi    = ((lsNB - lsNC*2 + lsNT) / dySqr);
      const DyyPhiPos = ((lsNC - lsNT*2 + levelSetN[x][yp2][z]) / dySqr);
      const DyyPhiNeg = ((levelSetN[x][ym2][z] - lsNB*2 + lsNC) / dySqr);
      const DzzPhi    = ((lsND - lsNC*2 + lsNU) / dzSqr);
      const DzzPhiPos = ((lsNC - lsNU*2 + levelSetN[x][y][zp2]) / dzSqr);
      const DzzPhiNeg = ((levelSetN[x][y][zm2] - lsND*2 + lsNC) / dzSqr);
      
      const bCondPosX = ls0C*levelSet0[xp1][y][z];
      const bCondNegX = ls0C*levelSet0[xm1][y][z];
      const bCondPosY = ls0C*levelSet0[x][yp1][z];
      const bCondNegY = ls0C*levelSet0[x][ym1][z];
      const bCondPosZ = ls0C*levelSet0[x][y][zp1];
      const bCondNegZ = ls0C*levelSet0[x][y][zm1];

      const bEpsilon = 1e-6;
      let DxPosPhi = 0, DxNegPhi = 0, DyPosPhi = 0, DyNegPhi = 0, DzPosPhi = 0, DzNegPhi = 0;

      // Boundary conditions - TODO: Move this into its own routine and save as buffers for reuse with this routine!
      if (bCondPosX < 0) {
        const phiXX0Pos = minmod(
          levelSet0[xm1][y][z] - 2*ls0C + levelSet0[xp1][y][z],
          ls0C - 2*levelSet0[xp1][y][z] + levelSet0[xp2][y][z]
        );
        let dxPos = dx;
        if (Math.abs(phiXX0Pos) > bEpsilon) {
          const discrimXPos = Math.pow(0.5*phiXX0Pos - ls0C - levelSet0[xp1][y][z], 2) - 4*ls0C*levelSet0[xp1][y][z];
          dxPos = dx*(0.5 + (ls0C-levelSet0[xp1][y][z]-Math.sign(ls0C-levelSet0[xp1][y][z])*Math.sqrt(discrimXPos))/phiXX0Pos);
        }
        else {
          dxPos = dx*(ls0C/(ls0C-levelSet0[xp1][y][z]+1e-6));
        }
        DxPosPhi = ((0 - lsNC)/dxPos) - 0.5*dxPos*minmod(DxxPhi, DxxPhiPos);
      }
      else {
        DxPosPhi = ((lsNR - lsNC)/dx) - 0.5*dx*minmod(DxxPhi, DxxPhiPos);
      }

      if (bCondNegX < 0) {
        const phiXX0Neg = minmod(
          levelSet0[xm1][y][z] - 2*ls0C + levelSet0[xp1][y][z],
          ls0C - 2*levelSet0[xm1][y][z] + levelSet0[xm2][y][z]
        );
        let dxNeg = dx;
        if (Math.abs(phiXX0Neg) > bEpsilon) {
          const discrimXNeg = Math.pow(0.5*phiXX0Neg - ls0C - levelSet0[xm1][y][z], 2) - 4*ls0C*levelSet0[xm1][y][z];
          dxNeg = dx*(0.5 + (ls0C-levelSet0[xm1][y][z]-Math.sign(ls0C-levelSet0[xm1][y][z])*Math.sqrt(discrimXNeg))/phiXX0Neg);
        }
        else {
          dxNeg = dx*(ls0C/(ls0C-levelSet0[xm1][y][z]+1e-6));
        }
        DxNegPhi = ((lsNC - 0)/dxNeg) + 0.5*dxNeg*minmod(DxxPhi, DxxPhiNeg);
      }
      else {
        DxNegPhi = ((lsNC - lsNL)/dx) + 0.5*dx*minmod(DxxPhi, DxxPhiNeg);
      }
     
      if (bCondPosY < 0) {
        const phiYY0Pos = minmod(
          levelSet0[x][ym1][z] - 2*ls0C + levelSet0[x][yp1][z],
          ls0C - 2*levelSet0[x][yp1][z] + levelSet0[x][yp2][z]
        );
        let dyPos = dy;
        if (Math.abs(phiYY0Pos) > bEpsilon) {
          const discrimYPos = Math.pow(0.5*phiYY0Pos - ls0C - levelSet0[x][yp1][z], 2) - 4*ls0C*levelSet0[x][yp1][z];
          dyPos = dy*(0.5 + (ls0C-levelSet0[x][yp1][z]-Math.sign(ls0C-levelSet0[x][yp1][z])*Math.sqrt(discrimYPos))/phiYY0Pos);
        }
        else {
          dyPos = dy*(ls0C/(ls0C-levelSet0[x][yp1][z]+1e-6));
        }
        DyPosPhi = ((0 - lsNC)/dyPos) - 0.5*dyPos*minmod(DyyPhi, DyyPhiPos);
      }
      else {
        DyPosPhi = ((lsNT - lsNC)/dy) - 0.5*dy*minmod(DyyPhi, DyyPhiPos);
      }

      if (bCondNegY < 0) {
        const phiYY0Neg = minmod(
          levelSet0[x][ym1][z] - 2*ls0C + levelSet0[x][yp1][z],
          ls0C - 2*levelSet0[x][ym1][z] + levelSet0[x][ym2][z]
        );
        let dyNeg = dy
        if (Math.abs(phiYY0Neg) > bEpsilon) {
          const discrimYNeg = Math.pow(0.5*phiYY0Neg - ls0C - levelSet0[x][ym1][z], 2) - 4*ls0C*levelSet0[x][ym1][z];
          dyNeg = dy*(0.5 + (ls0C-levelSet0[x][ym1][z]-Math.sign(ls0C-levelSet0[x][ym1][z])*Math.sqrt(discrimYNeg))/phiYY0Neg);
        }
        else {
          dyNeg = dy*(ls0C/(ls0C-levelSet0[x][ym1][z]+1e-6));
        }
        DyNegPhi = ((lsNC - 0)/dyNeg) + 0.5*dyNeg*minmod(DyyPhi, DyyPhiNeg);
      }
      else {
        DyNegPhi = ((lsNC - lsNB)/dy) + 0.5*dy*minmod(DyyPhi, DyyPhiNeg);
      }

      if (bCondPosZ < 0) {
        const phiZZ0Pos = minmod(
          levelSet0[x][y][zm1] - 2*ls0C + levelSet0[x][y][zp1],
          ls0C - 2*levelSet0[x][y][zp1] + levelSet0[x][y][zp2]
        );
        let dzPos = dz;
        if (Math.abs(phiZZ0Pos) > bEpsilon) {
          const discrimZPos = Math.pow(0.5*phiZZ0Pos - ls0C - levelSet0[x][y][zp1], 2) - 4*ls0C*levelSet0[x][y][zp1];
          dzPos = dz*(0.5 + (ls0C-levelSet0[x][y][zp1]-Math.sign(ls0C-levelSet0[x][y][zp1])*Math.sqrt(discrimZPos))/phiZZ0Pos);
        }
        else {
          dzPos = dz*(ls0C/(ls0C-levelSet0[x][y][zp1]+1e-6));
        }
        DzPosPhi = ((0 - lsNC)/dzPos) - 0.5*dzPos*minmod(DzzPhi, DzzPhiPos);
      }
      else {
        DzPosPhi = ((lsNU - lsNC)/dz) - 0.5*dz*minmod(DzzPhi, DzzPhiPos);
      }

      if (bCondNegZ < 0) {
        const phiZZ0Neg = minmod(
          levelSet0[x][y][zm1] - 2*ls0C + levelSet0[x][y][zp1],
          ls0C - 2*levelSet0[x][y][zm1] + levelSet0[x][y][zm2]
        );
        let dzNeg = dz;
        if (Math.abs(phiZZ0Neg) > bEpsilon) {
          const discrimZNeg = Math.pow(0.5*phiZZ0Neg - ls0C - levelSet0[x][y][zm1], 2) - 4*ls0C*levelSet0[x][y][zm1];
          dzNeg = dz*(0.5 + (ls0C-levelSet0[x][y][zm1]-Math.sign(ls0C-levelSet0[x][y][zm1])*Math.sqrt(discrimZNeg))/phiZZ0Neg);
        }
        else {
          dzNeg = dz*(ls0C/(ls0C-levelSet0[x][y][zm1]+1e-6));
        }  
        DzNegPhi = ((lsNC - 0)/dzNeg) + 0.5*dzNeg*minmod(DzzPhi, DzzPhiNeg);
      }
      else {
        DzNegPhi = ((lsNC - lsND)/dz) + 0.5*dz*minmod(DzzPhi, DzzPhiNeg);
      }
      
      const GPhi = godunovH(sgnPhi0, DxPosPhi, DxNegPhi, DyPosPhi, DyNegPhi, DzPosPhi, DzNegPhi);
      return lsNC - dt*sgnPhi0*(GPhi-1.0);

    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      dt: 'Float', levelSet0: 'Array', levelSetN: 'Array', boundaryBuf: 'Array'
    }});

    this.avectLiquidVelocity = this.gpu.createKernel(function(dt, vel0, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY) {
        return [0,0,0];
      }

      // Back-step the velocity to the sample point that the current cell value came from
      // then bilinearly interpolate that from the grid cells
      const vel0xyz = vel0[x][y][z];
      const dt0 = dt;//*this.constants.N;
      
      const xx = clampValue(x-dt0*vel0xyz[0], 0.5, this.constants.NPLUSAHALF);
      const yy = clampValue(y-dt0*vel0xyz[1], 0.5, this.constants.NPLUSAHALF);
      const zz = clampValue(z-dt0*vel0xyz[2], 0.5, this.constants.NPLUSAHALF);
      const i0 = Math.floor(xx), i1 = i0 + 1;
      const j0 = Math.floor(yy), j1 = j0 + 1;
      const k0 = Math.floor(zz), k1 = k0 + 1;
      const sx1 = xx-i0, sx0 = 1-sx1;
      const sy1 = yy-j0, sy0 = 1-sy1;
      const sz1 = zz-k0, sz0 = 1-sz1;

      const vel0i0j0k0 = vel0[i0][j0][k0];
      const vel0i0j1k0 = vel0[i0][j1][k0];
      const vel0i1j0k0 = vel0[i1][j0][k0];
      const vel0i1j1k0 = vel0[i1][j1][k0];
      const vel0i0j0k1 = vel0[i0][j0][k1];
      const vel0i0j1k1 = vel0[i0][j1][k1];
      const vel0i1j0k1 = vel0[i1][j0][k1];
      const vel0i1j1k1 = vel0[i1][j1][k1];

      const result = [0,0,0];
      for (let i = 0; i < 3; i++) {
        const v0 = sx0*(sy0*vel0i0j0k0[i] + sy1*vel0i0j1k0[i]) + sx1*(sy0*vel0i1j0k0[i] + sy1*vel0i1j1k0[i]);
        const v1 = sx0*(sy0*vel0i0j0k1[i] + sy1*vel0i0j1k1[i]) + sx1*(sy0*vel0i1j0k1[i] + sy1*vel0i1j1k1[i]);
        result[i] = sz0*v0 + sz1*v1;
      }
      return result;
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {
      dt: 'Float', vel0: 'Array3D(3)', boundaryBuf: 'Array'
    }});

    this.applyLiquidVorticity = this.gpu.createKernel(function(vel, boundaryBuf) {
      const [x,y,z] = xyzLookup();

      const L = vel[clampm1(x)][y][z]; const R = vel[clampp1(x)][y][z];
      const B = vel[x][clampm1(y)][z]; const T = vel[x][clampp1(y)][z];
      const D = vel[x][y][clampm1(z)]; const U = vel[x][y][clampp1(z)];
      return [
        0.5 * ((T[2] - B[2]) - (U[1] - D[1])),
        0.5 * ((U[0] - D[0]) - (R[2] - L[2])),
        0.5 * ((R[1] - L[1]) - (T[0] - B[0]))
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes:{vel: 'Array3D(3)', boundaryBuf: 'Array'}});

    this.applyLiquidConfinement = this.gpu.createKernel(function(dt, epsilon, tempVec3, vel, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      let velxyz = vel[x][y][z];

      const omega  = tempVec3[x][y][z];
      const omegaL = length3(tempVec3[clampm1(x)][y][z]);
      const omegaR = length3(tempVec3[clampp1(x)][y][z]);
      const omegaB = length3(tempVec3[x][clampm1(y)][z]);
      const omegaT = length3(tempVec3[x][clampp1(y)][z]);
      const omegaD = length3(tempVec3[x][y][clampm1(z)]);
      const omegaU = length3(tempVec3[x][y][clampp1(z)]);

      const eta = normalize3([0.5 * (omegaR - omegaL), 0.5 * (omegaT - omegaB), 0.5 * (omegaU - omegaD)]);
      const dtEpsilon = dt*epsilon;
      return [
        velxyz[0] + dtEpsilon * (eta[1]*omega[2] - eta[2]*omega[1]),
        velxyz[1] + dtEpsilon * (eta[2]*omega[0] - eta[0]*omega[2]),
        velxyz[2] + dtEpsilon * (eta[0]*omega[1] - eta[1]*omega[0])
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes:{
      dt: 'Float', epsilon: 'Float', tempVec3: 'Array3D(3)', vel: 'Array3D(3)', boundaryBuf: 'Array'
    }});

    this.computeLiquidVelDiv = this.gpu.createKernel(function(vel, boundaryBuf) {
      const [x,y,z] = xyzLookup();

      const xm1 = clampm1(x); const xp1 = clampp1(x);
      const ym1 = clampm1(y); const yp1 = clampp1(y);
      const zm1 = clampm1(z); const zp1 = clampp1(z);

      // NOTE: If the boundary has a velocity then change noVel to that velocity!
      const noVel = [0,0,0];
      const fieldL = (boundaryBuf[xm1][y][z] > this.constants.BOUNDARY) ? noVel : vel[xm1][y][z];
      const fieldR = (boundaryBuf[xp1][y][z] > this.constants.BOUNDARY) ? noVel : vel[xp1][y][z];
      const fieldB = (boundaryBuf[x][ym1][z] > this.constants.BOUNDARY) ? noVel : vel[x][ym1][z];
      const fieldT = (boundaryBuf[x][yp1][z] > this.constants.BOUNDARY) ? noVel : vel[x][yp1][z];
      const fieldD = (boundaryBuf[x][y][zm1] > this.constants.BOUNDARY) ? noVel : vel[x][y][zm1];
      const fieldU = (boundaryBuf[x][y][zp1] > this.constants.BOUNDARY) ? noVel : vel[x][y][zp1];

      return 0.5 * ((fieldR[0]-fieldL[0]) + (fieldT[1]-fieldB[1]) + (fieldU[2]-fieldD[2]));
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes:{vel:'Array3D(3)', boundaryBuf:'Array'}});

    this.applyExternalForcesToLiquid = this.gpu.createKernel(function(dt, mass, force, vel, levelSet, levelEpsilon, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY){
        return [0,0,0];
      }
      const currVel = vel[x][y][z];
      if (levelSet[x][y][z] > 0) {
        return currVel;
      }

      const dtDivMass = dt/mass;
      const du = [dtDivMass * force[0], dtDivMass * force[1], dtDivMass * force[2]];
      const newVel = [currVel[0] + du[0], currVel[1] + du[1], currVel[2] + du[2]];
      return newVel;

    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {
      dt: 'Float', mass: 'Float', force: 'Array', vel: 'Array3D(3)', levelSet: 'Array', 
      levelEpsilon: 'Float', boundaryBuf: 'Array'
    }});

    this.liquidLevelSetPressure = this.gpu.createKernel(function(pressure, levelSet) {
      const [x,y,z] = xyzLookup();
      // There should be no pressure outside the liquid boundaries
      return (levelSet[x][y][z] > 0) ? 0.0 : pressure[x][y][z];
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      pressure: 'Array', levelSet: 'Array'
    }});

    this.jacobiLiquid = this.gpu.createKernel(function(pressure, tempScalar, boundaryBuf, levelSet) {
      const [x,y,z] = xyzLookup();

      const pCenter = pressure[x][y][z];
      const bC = tempScalar[x][y][z]; // Contains the 'divergence' calculated previously

      const xm1 = clampm1(x); const xp1 = clampp1(x);
      const ym1 = clampm1(y); const yp1 = clampp1(y);
      const zm1 = clampm1(z); const zp1 = clampp1(z);
    
      const pL = (boundaryBuf[xm1][y][z] > this.constants.BOUNDARY) ? pCenter : pressure[xm1][y][z];
      const pR = (boundaryBuf[xp1][y][z] > this.constants.BOUNDARY) ? pCenter : pressure[xp1][y][z];
      const pB = (boundaryBuf[x][ym1][z] > this.constants.BOUNDARY) ? pCenter : pressure[x][ym1][z];
      const pT = (boundaryBuf[x][yp1][z] > this.constants.BOUNDARY) ? pCenter : pressure[x][yp1][z];
      const pD = (boundaryBuf[x][y][zm1] > this.constants.BOUNDARY) ? pCenter : pressure[x][y][zm1];
      const pU = (boundaryBuf[x][y][zp1] > this.constants.BOUNDARY) ? pCenter : pressure[x][y][zp1];
      return (pL + pR + pB + pT + pU + pD - bC) / 6.0;
      
    }, {...pipelineFuncSettings, returnType:'Float', argumentTypes: {
      pressure: 'Array', tempScalar: 'Array', boundaryBuf: 'Array', levelSet: 'Array'
    }});

    this.projectLiquidVelocity = this.gpu.createKernel(function(pressure, vel, boundaryBuf, levelSet) {
      const [x,y,z] = xyzLookup();
      const velxyz = vel[x][y][z];
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY) {
        return [0,0,0]; // NOTE: If the boundary has a velocity, return it here!
      }

      const xm1 = clampm1(x); const xp1 = clampp1(x);
      const ym1 = clampm1(y); const yp1 = clampp1(y);
      const zm1 = clampm1(z); const zp1 = clampp1(z);

      const pCenter = pressure[x][y][z];
      const pL = pressure[xm1][y][z], pR = pressure[xp1][y][z];
      const pB = pressure[x][ym1][z], pT = pressure[x][yp1][z];
      const pD = pressure[x][y][zm1], pU = pressure[x][y][zp1];

      //const lsCenter = levelSet[x][y][z];
      const lsL = levelSet[xm1][y][z], lsR = levelSet[xp1][y][z];
      const lsB = levelSet[x][ym1][z], lsT = levelSet[x][yp1][z];
      const lsD = levelSet[x][y][zm1], lsU = levelSet[x][y][zp1];

      // NOTE: This requires augmentation if the boundaries have velocity!
      const obstV = [0,0,0];
      const vMask = [1,1,1];

      let finalpL = pL;
      if (boundaryBuf[xm1][y][z] > this.constants.BOUNDARY) { finalpL = pCenter; obstV[0] = 0; vMask[0] = 0; }
      if (lsL > 0) { finalpL = 0; }
      
      //else if (lsL*lsR < 0) { finalpL = lsL < 0 ? pL : lsL/Math.min(1e-6, lsR)*pR; }

      let finalpR = pR;
      if (boundaryBuf[xp1][y][z] > this.constants.BOUNDARY) { finalpR = pCenter; obstV[0] = 0; vMask[0] = 0; }
      if (lsR > 0) { finalpR = 0; }
     
      //else if (lsL*lsR < 0) {  finalpR = lsR < 0 ? pR : lsR/Math.min(1e-6, lsL)*pL; }

      let finalpB = pB;
      if (boundaryBuf[x][ym1][z] > this.constants.BOUNDARY) { finalpB = pCenter; obstV[1] = 0; vMask[1] = 0; }
      if (lsB > 0) { finalpB = 0; }
      //else if (lsB*lsT < 0) { finalpB = lsB < 0 ? pB : lsB/Math.min(1e-6, lsT)*pT; }

      let finalpT = pT;
      if (boundaryBuf[x][yp1][z] > this.constants.BOUNDARY) { finalpT = pCenter; obstV[1] = 0; vMask[1] = 0; }
      if (lsT > 0) { finalpT = 0; }
      //else if (lsB*lsT < 0) { finalpT = lsT < 0 ? pT : lsT/Math.min(1e-6, lsB)*pB; }

      let finalpD = pD;
      if (boundaryBuf[x][y][zm1] > this.constants.BOUNDARY) { finalpD = pCenter; obstV[2] = 0; vMask[2] = 0; }
      if (lsD > 0) { finalpD = 0; }
      //else if (lsD*lsU < 0) { finalpD = lsD < 0 ? pD : lsD/Math.min(1e-6, lsU)*pU; }

      let finalpU = pU;
      if (boundaryBuf[x][y][zp1] > this.constants.BOUNDARY) { finalpU = pCenter; obstV[2] = 0; vMask[2] = 0; }
      if (lsU > 0) { finalpU = 0; }
      //else if (lsD*lsU < 0) { finalpU = lsU < 0 ? pU : lsU/Math.min(1e-6, lsD)*pD; }

      const vNew = [
        velxyz[0] - 0.5 * (finalpR - finalpL), 
        velxyz[1] - 0.5 * (finalpT - finalpB), 
        velxyz[2] - 0.5 * (finalpU - finalpD)
      ];
      return [vMask[0]*vNew[0]+obstV[0], vMask[1]*vNew[1]+obstV[1], vMask[2]*vNew[2]+obstV[2]];

    }, {...pipelineFuncSettings, returnType:'Array(3)', argumentTypes: {
      pressure:'Array', vel:'Array3D(3)', boundaryBuf:'Array', levelSet: 'Array'
    }});

    this._liquidKernelsInit = true;
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