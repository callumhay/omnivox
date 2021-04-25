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

    this.waterOverwrite = this.gpu.createKernel(function(waterLookup, airLookup, levelSet, boundaryBuf, levelEpsilon, offsetXYZ) {
      // The water level is negative if in water, 0 at boundary, and positive outside of the water
      const x = this.thread.z + offsetXYZ[2];
      const y = this.thread.y + offsetXYZ[1];
      const z = this.thread.x + offsetXYZ[0];
      if (boundaryBuf[x][y][z] > 0.9) { return [0.1,0.1,0.1]; }
      const waterLevel = levelSet[x][y][z];
      const idx = clampValue(Math.floor(Math.abs(waterLevel)), 0, this.constants.halfGridSize);
      const voxelColour =  waterLevel < -levelEpsilon ? waterLookup[idx] : airLookup[idx];
      return [voxelColour[0], voxelColour[1], voxelColour[2]];

    }, {...this.pipelineFuncSettings,
      argumentTypes: { waterLookup: 'Array1D(4)', airLookup: 'Array1D(4)', levelSet: 'Array', boundaryBuf: 'Array', levelEpsilon: 'Float', offsetXYZ: 'Array'},
    });

    this.simpleWaterOverwrite = this.gpu.createKernel(function(
      cells, pressure, vel, maxLiquidVol, offsetXYZ) {

      const x = this.thread.z + offsetXYZ[2];
      const y = this.thread.y + offsetXYZ[1];
      const z = this.thread.x + offsetXYZ[0];
      const cell = cells[x][y][z];

      if (cell[1] === 1) { return [1,1,1]; }
      const cellLiquidVol = cell[0];
      const amt = clampValue(5*cellLiquidVol/maxLiquidVol,0,1);
      const extra = clampValue(4*(cellLiquidVol-maxLiquidVol),0,1);

      return [extra, 0.75*amt, amt];

    }, {...this.pipelineFuncSettings, argumentTypes: { 
      cells: 'Array3D(3)', pressure:'Array', vel:'Array3D(3)', maxLiquidVol: 'Float', offsetXYZ: 'Array'},
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

    this.gpu.addFunction(function xyzLookup() {
      return [this.thread.z, this.thread.y, this.thread.x];
    });
    this.gpu.addFunction(function clampm1(c) {
      return Math.max(c-1, 0);
    });
    this.gpu.addFunction(function clampm2(c) {
      return Math.max(c-2, 0);
    });
    this.gpu.addFunction(function clampmX(c,x) {
      return Math.max(c-x, 0);
    });
    this.gpu.addFunction(function clampp1(c) {
      return Math.min(c+1, this.constants.NPLUS1);
    });
    this.gpu.addFunction(function clampp2(c) {
      return Math.min(c+2, this.constants.NPLUS1);
    });
    this.gpu.addFunction(function clamppX(c,x) {
      return Math.min(c+x, this.constants.NPLUS1);
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
        BOUNDARY: 0.1,
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
      constants: { 
        N: N, NDIV2: N/2, NPLUS1: N+1, NPLUSAHALF: N+0.5, ONEDIVN: 1.0/N, 
        BOUNDARY: 0.1, DX:1, DY:1, DZ:1, MAX_ABS_SPD:10 },
      immutable: true,
    };

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
    this.gpu.addFunction(function trilinearLookup(x,y,z,tex,boundaryBuf) {
      const xx = clampValue(x, 0.5, this.constants.NPLUSAHALF);
      const yy = clampValue(y, 0.5, this.constants.NPLUSAHALF);
      const zz = clampValue(z, 0.5, this.constants.NPLUSAHALF);
      const i0 = Math.floor(xx), i1 = i0 + 1;
      const j0 = Math.floor(yy), j1 = j0 + 1;
      const k0 = Math.floor(zz), k1 = k0 + 1;
      const sx1 = xx-i0, sx0 = 1-sx1;
      const sy1 = yy-j0, sy0 = 1-sy1;
      const sz1 = zz-k0, sz0 = 1-sz1;

      const b000 = (1-boundaryBuf[i0][j0][k0]), b010 = (1-boundaryBuf[i0][j1][k0]), b100 = (1-boundaryBuf[i1][j0][k0]);
      const b110 = (1-boundaryBuf[i1][j1][k0]), b001 = (1-boundaryBuf[i0][j0][k1]), b011 = (1-boundaryBuf[i0][j1][k1]);
      const b101 = (1-boundaryBuf[i1][j0][k1]), b111 = (1-boundaryBuf[i1][j1][k1]);

      const ls0 = sx0*(sy0*tex[i0][j0][k0]*b000 + sy1*tex[i0][j1][k0]*b010) + sx1*(sy0*tex[i1][j0][k0]*b100 + sy1*tex[i1][j1][k0]*b110);
      const ls1 = sx0*(sy0*tex[i0][j0][k1]*b001 + sy1*tex[i0][j1][k1]*b011) + sx1*(sy0*tex[i1][j0][k1]*b101 + sy1*tex[i1][j1][k1]*b111);
      return (sz0*ls0 + sz1*ls1);
    });
    this.gpu.addFunction(function heaviside(lsVal, levelEpsilon) {
      return lsVal > levelEpsilon ? 0 : 1;
      return (lsVal > levelEpsilon) ? 0 : ((lsVal < -levelEpsilon) ? 1 : 
          ((lsVal+levelEpsilon)/(2*levelEpsilon) + Math.sin(Math.PI*lsVal/levelEpsilon)/(2*Math.PI)));
    });
    this.gpu.addFunction(function heavisideP(lsC, pC, levelEpsilon) {
      // There should be no pressure outside the liquid boundaries, at the boundary we smooth it out
      return heaviside(lsC, levelEpsilon)*pC;
    });
   
    this.gpu.addFunction(function calcWENOPhi(a,b,c,d) {
      const EPSILON = 1e-6;

      const IS0 = 13*Math.pow(a-b,2) + 3*Math.pow(a-3*b,2);
      const IS1 = 13*Math.pow(b-c,2) + 3*Math.pow(b+c,2);
      const IS2 = 13*Math.pow(c-d,2) + 3*Math.pow(3*c-d,2);
      const alpha0 = 1.0 / Math.pow(EPSILON + IS0,2);
      const alpha1 = 6.0 / Math.pow(EPSILON + IS1,2);
      const alpha2 = 3.0 / Math.pow(EPSILON + IS2,2);
      const denom  = alpha0+alpha1+alpha2+EPSILON;
      const omega0 = alpha0 / denom, omega2 = alpha2 / denom;

      return (1/3)*omega0*(a-2*b+c) + (1/6)*(omega2-0.5)*(b-2*c+d);
    });

    this.gpu.addFunction(function calcPhiPlusMinusWENO(phiK, phiKP1, phiKP2, phiKP3, phiKM1, phiKM2, phiKM3, dk) {
      const dPhiKPosM2 = phiKM1-phiKM2, dPhiKPosM1 = phiK-phiKM1;
      const dPhiKPos   = phiKP1-phiK,   dPhiKPosP1 = phiKP2-phiKP1;

      const nonWENOK = (1/(12*dk))*(-dPhiKPosM2 + 7*dPhiKPosM1 + 7*dPhiKPos - dPhiKPosP1);

      const aNeg = (phiKM1 - 2*phiKM2 + phiKM3)/dk;
      const bNeg = (phiK   - 2*phiKM1 + phiKM2)/dk;
      const cNeg = (phiKP1 - 2*phiK   + phiKM1)/dk;
      const dNeg = (phiKP2 - 2*phiKP1 + phiK)/dk;
      const WENOKNeg = calcWENOPhi(aNeg, bNeg, cNeg, dNeg);

      const aPos = (phiKP3 - 2*phiKP2 + phiKP1)/dk;
      const bPos = (phiKP2 - 2*phiKP1 + phiK)/dk;
      const cPos = (phiKP1 - 2*phiK   + phiKM1)/dk;
      const dPos = (phiK   - 2*phiKM1 + phiKM2)/dk;
      const WENOKPos = calcWENOPhi(aPos, bPos, cPos, dPos);

      const phiNegWENO = nonWENOK - WENOKNeg;
      const phiPosWENO = nonWENOK + WENOKPos;
      return [phiNegWENO, phiPosWENO];
    });

    this.gpu.addFunction(function delPhiWENO(x,y,z,phi,upwindVec,boundaryBuf) {
      const xm1 = clampm1(x), xm2 = clampm2(x), xm3 = clampmX(x,3), 
            xp1 = clampp1(x), xp2 = clampp2(x), xp3 = clamppX(x,3);
      const ym1 = clampm1(y), ym2 = clampm2(y), ym3 = clampmX(y,3),
            yp1 = clampp1(y), yp2 = clampp2(y), yp3 = clamppX(y,3);
      const zm1 = clampm1(z), zm2 = clampm2(z), zm3 = clampmX(z,3),
            zp1 = clampp1(z), zp2 = clampp2(z), zp3 = clamppX(z,3);

      //const bP1X = 1, bP2X = 1, bP3X = 1;
      //const bM1X = 1, bM2X = 1, bM3X = 1;
      const bP1X = (1-boundaryBuf[xp1][y][z]), bP2X = (1-boundaryBuf[xp2][y][z]), bP3X = (1-boundaryBuf[xp3][y][z]);
      const bM1X = (1-boundaryBuf[xm1][y][z]), bM2X = (1-boundaryBuf[xm2][y][z]), bM3X = (1-boundaryBuf[xm3][y][z]);
      const wenoXPM = calcPhiPlusMinusWENO(
        phi[x][y][z], phi[xp1][y][z]*bP1X + phi[x][y][z]*(1-bP1X), phi[xp2][y][z]*bP2X + phi[x][y][z]*(1-bP2X), phi[xp3][y][z]*bP3X + phi[x][y][z]*(1-bP3X),
        phi[xm1][y][z]*bM1X + phi[x][y][z]*(1-bM1X), phi[xm2][y][z]*bM2X + phi[x][y][z]*(1-bM2X), phi[xm3][y][z]*bM3X + phi[x][y][z]*(1-bM3X), this.constants.DX
      );
      //const bP1Y = 1, bP2Y = 1, bP3Y = 1;
      //const bM1Y = 1, bM2Y = 1, bM3Y = 1;
      const bP1Y = (1-boundaryBuf[x][yp1][z]), bP2Y = (1-boundaryBuf[x][yp2][z]), bP3Y = (1-boundaryBuf[x][yp3][z]);
      const bM1Y = (1-boundaryBuf[x][ym1][z]), bM2Y = (1-boundaryBuf[x][ym2][z]), bM3Y = (1-boundaryBuf[x][ym3][z]);
      const wenoYPM = calcPhiPlusMinusWENO(
        phi[x][y][z], phi[x][yp1][z]*bP1Y + phi[x][y][z]*(1-bP1Y), phi[x][yp2][z]*bP2Y + phi[x][y][z]*(1-bP2Y), phi[x][yp3][z]*bP3Y + phi[x][y][z]*(1-bP3Y),
        phi[x][ym1][z]*bM1Y + phi[x][y][z]*(1-bM1Y), phi[x][ym2][z]*bM2Y + phi[x][y][z]*(1-bM2Y), phi[x][ym3][z]*bM3Y + phi[x][y][z]*(1-bM3Y), this.constants.DY
      );
      //const bP1Z = 1, bP2Z = 1, bP3Z = 1;
      //const bM1Z = 1, bM2Z = 1, bM3Z = 1;
      const bP1Z = (1-boundaryBuf[x][y][zp1]), bP2Z = (1-boundaryBuf[x][y][zp2]), bP3Z = (1-boundaryBuf[x][y][zp3]);
      const bM1Z = (1-boundaryBuf[x][y][zm1]), bM2Z = (1-boundaryBuf[x][y][zm2]), bM3Z = (1-boundaryBuf[x][y][zm3]);
      const wenoZPM = calcPhiPlusMinusWENO(
        phi[x][y][z], phi[x][y][zp1]*bP1Z + phi[x][y][z]*(1-bP1Z), phi[x][y][zp2]*bP2Z + phi[x][y][z]*(1-bP2Z), phi[x][y][zp3]*bP3Z +  phi[x][y][z]*(1-bP3Z),
        phi[x][y][zm1]*bM1Z + phi[x][y][z]*(1-bM1Z), phi[x][y][zm2]*bM2Z +  phi[x][y][z]*(1-bM2Z), phi[x][y][zm3]*bM3Z + phi[x][y][z]*(1-bM3Z), this.constants.DZ
      );
        /*
      return [
        godunovH(-upwindVec[0], wenoXPM[1], wenoXPM[0], wenoYPM[1], wenoYPM[0], wenoZPM[1], wenoZPM[0]),
        godunovH(-upwindVec[1], wenoXPM[1], wenoXPM[0], wenoYPM[1], wenoYPM[0], wenoZPM[1], wenoZPM[0]),
        godunovH(-upwindVec[2], wenoXPM[1], wenoXPM[0], wenoYPM[1], wenoYPM[0], wenoZPM[1], wenoZPM[0])
      ];
      */

      return [
        upwindVec[0] >= 0 ? wenoXPM[0] : wenoXPM[1],
        upwindVec[1] >= 0 ? wenoYPM[0] : wenoYPM[1],
        upwindVec[2] >= 0 ? wenoZPM[0] : wenoZPM[1]
      ];
    });
   

    this.injectLiquidSphere = this.gpu.createKernel(function(center, radius, levelSet, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      const centerToLookup = [x-center[0], y-center[1], z-center[2]];
      const lsVal = length3(centerToLookup) - radius;
      const lsxyz = levelSet[x][y][z];
      return lsxyz < lsVal ? lsxyz : lsVal; // Output the level set value (negative in liquid, positive outside)
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      center: 'Array', radius: 'Float', levelSet: 'Array', boundaryBuf: 'Array'
    }});

    this.injectForceBlob = this.gpu.createKernel(function(center, impulseStrength, size, vel, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return [0,0,0]; }

      const u = vel[x][y][z];
      const dir = [x-center[0], y-center[1], z-center[2]];
      const len = length3(dir);
      return len > size ? u : [u[0] + impulseStrength*dir[0], u[1] + impulseStrength*dir[1], u[2] + impulseStrength*dir[2]];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {
      center: 'Array', impulseStrength: 'Float', size: 'Float', vel: 'Array3D(3)', boundaryBuf: 'Array'
    }});

    this.pressureDiff = this.gpu.createKernel(function(p0, p1) {
      const [x,y,z] = xyzLookup();
      return p0[x][y][z] - p1[x][y][z];
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      p0: 'Array', p1: 'Array',
    }});

    this.advectLiquidLevelSet = this.gpu.createKernel(function(dt, vel, levelSet, boundaryBuf, forward, decay) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 ||
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return levelSet[x][y][z]; }

      const velxyz = vel[x][y][z];
      const u = [velxyz[0]*forward, velxyz[1]*forward, velxyz[2]*forward];
      const delPhi = delPhiWENO(x,y,z,levelSet,u,boundaryBuf);
      const du = [-dt*u[0], -dt*u[1], -dt*u[2]];

      //const triLookup  = trilinearLookup(x+du[0], y+du[1], z+du[2], levelSet, boundaryBuf);
      const wenoLookup = levelSet[x][y][z] + (du[0]*delPhi[0] + du[1]*delPhi[1] + du[2]*delPhi[2]);
      return wenoLookup*decay;//(triLookup+wenoLookup) * 0.5 * decay;

    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      dt: 'Float', vel: 'Array3D(3)', levelSet: 'Array', boundaryBuf: 'Array', forward: 'Float', decay: 'Float'
    }})
    this.advectLiquidLevelSetOrder2 = this.gpu.createKernel(function(
      dt, vel, phiN, phi1, boundaryBuf) {

      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY ||  x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return phiN[x][y][z]; }

      const u = vel[x][y][z];
      const delPhi1 = delPhiWENO(x,y,z,phi1,u,boundaryBuf);
      const du = [-dt*u[0], -dt*u[1], -dt*u[2]];
      return 0.75*phiN[x][y][z] + 0.25*phi1[x][y][z] + 
        0.25*(du[0]*delPhi1[0] + du[1]*delPhi1[1] + du[2]*delPhi1[2]);

    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      dt: 'Float', vel: 'Array3D(3)', phiN: 'Array', phi1: 'Array', boundaryBuf: 'Array'
    }});
    this.advectLiquidLevelSetOrder3 = this.gpu.createKernel(function(
      dt, vel, phiN, phi2, boundaryBuf, decay, damping) {

      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return phiN[x][y][z]; }

      const u = vel[x][y][z];
      const delPhi2 = delPhiWENO(x,y,z,phi2,u,boundaryBuf);
      const du = [-dt*u[0], -dt*u[1], -dt*u[2]];
      const phiNxyz = phiN[x][y][z];

      return (damping*phiNxyz + (1-damping) * ((1/3)*phiNxyz + (2/3)*phi2[x][y][z] +
       (2/3)*(du[0]*delPhi2[0] + du[1]*delPhi2[1] + du[2]*delPhi2[2]))) * decay;

    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      dt: 'Float', vel: 'Array3D(3)', phiN: 'Array', phi2: 'Array', boundaryBuf: 'Array', 
      decay: 'Float', damping: 'Float'
    }});

    this.rungeKuttaLevelSet = this.gpu.createKernel(function(levelSetN, levelSetNPlus2, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return levelSetN[x][y][z]; }
      return 0.5*(levelSetN[x][y][z] + levelSetNPlus2[x][y][z]);
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      levelSetN: 'Array', levelSetNPlus2: 'Array', boundaryBuf: 'Array'
    }});

    this.reinitLevelSet = this.gpu.createKernel(function(dt, levelSet0, levelSetN, boundaryBuf, damping) {
      const [x,y,z] = xyzLookup();

      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return levelSetN[x][y][z]; }

      const lsNC = levelSetN[x][y][z];
      const ls0C = levelSet0[x][y][z];

      const xm1 = clampm1(x), xm2 = clampm2(x), xp1 = clampp1(x), xp2 = clampp2(x);
      const ym1 = clampm1(y), ym2 = clampm2(y), yp1 = clampp1(y), yp2 = clampp2(y);
      const zm1 = clampm1(z), zm2 = clampm2(z), zp1 = clampp1(z), zp2 = clampp2(z);

      const dx = this.constants.DX, dy = this.constants.DY, dz = this.constants.DZ;
      const dxSqr = dx*dx, dySqr = dy*dy, dzSqr = dz*dz;

      const sgnPhi0 = ls0C < -dx ? -1 : (ls0C > dx ? 1 : ls0C / Math.sqrt(ls0C*ls0C + 2*dxSqr)); // Calculate the Sign(levelSet0(x,y,z))

      // Calculate the gradient function for moving towards a steady-state where the signed distance
      // is properly reinitialized
      const lsNL = levelSetN[xm1][y][z], lsNR = levelSetN[xp1][y][z];
      const lsNB = levelSetN[x][ym1][z], lsNT = levelSetN[x][yp1][z];
      const lsND = levelSetN[x][y][zm1], lsNU = levelSetN[x][y][zp1];

      const lsNLL = levelSetN[xm2][y][z], lsNRR = levelSetN[xp2][y][z];
      const lsNBB = levelSetN[x][ym2][z], lsNTT = levelSetN[x][yp2][z];
      const lsNDD = levelSetN[x][y][zm2], lsNUU = levelSetN[x][y][zp2];

      const DxxPhi    = ((lsNL - lsNC*2 + lsNR) / dxSqr);
      const DxxPhiPos = ((lsNC - lsNR*2 + lsNRR) / dxSqr);
      const DxxPhiNeg = ((lsNLL - lsNL*2 + lsNC) / dxSqr);
      const DyyPhi    = ((lsNB - lsNC*2 + lsNT) / dySqr);
      const DyyPhiPos = ((lsNC - lsNT*2 + lsNTT) / dySqr);
      const DyyPhiNeg = ((lsNBB - lsNB*2 + lsNC) / dySqr);
      const DzzPhi    = ((lsND - lsNC*2 + lsNU) / dzSqr);
      const DzzPhiPos = ((lsNC - lsNU*2 + lsNUU) / dzSqr);
      const DzzPhiNeg = ((lsNDD - lsND*2 + lsNC) / dzSqr);
      
      const ls0L = levelSet0[xm1][y][z], ls0R = levelSet0[xp1][y][z];
      const ls0B = levelSet0[x][ym1][z], ls0T = levelSet0[x][yp1][z];
      const ls0D = levelSet0[x][y][zm1], ls0U = levelSet0[x][y][zp1];

      const ls0LL = levelSet0[xm2][y][z], ls0RR = levelSet0[xp2][y][z];
      const ls0BB = levelSet0[x][ym2][z], ls0TT = levelSet0[x][yp2][z];
      const ls0DD = levelSet0[x][y][zm2], ls0UU = levelSet0[x][y][zp2];

      const bCondPosX = ls0C*ls0R, bCondNegX = ls0C*ls0L;
      const bCondPosY = ls0C*ls0T, bCondNegY = ls0C*ls0B;
      const bCondPosZ = ls0C*ls0U, bCondNegZ = ls0C*ls0D;

      const bEpsilon = 1e-6;
      let DxPosPhi = 0, DxNegPhi = 0, DyPosPhi = 0, DyNegPhi = 0, DzPosPhi = 0, DzNegPhi = 0;

      // Boundary conditions - TODO: Move this into its own routine and save as buffers for reuse with this routine!
      let dxPos = dx;
      if (bCondPosX < 0) {
        const phiXX0Pos = minmod(
          ls0L - 2*ls0C + ls0R,
          ls0C - 2*ls0R + ls0RR
        );
        const discrimXPos = Math.pow((0.5*phiXX0Pos - ls0C - ls0R), 2) - 4*ls0C*ls0R;
        if (Math.abs(phiXX0Pos) > bEpsilon && discrimXPos >= 0) {
          dxPos = dx*(0.5 + (ls0C-ls0R-Math.sign(ls0C-ls0R)*Math.sqrt(discrimXPos))/phiXX0Pos);
        }
        else {
          dxPos = dx*(ls0C/(ls0C-ls0R+1e-6));
        }
        DxPosPhi = ((0 - lsNC)/(dxPos+1e-6)) - 0.5*dxPos*minmod(DxxPhi, DxxPhiPos);
      }
      else {
        DxPosPhi = ((lsNR - lsNC)/dx) - 0.5*dx*minmod(DxxPhi, DxxPhiPos);
      }

      let dxNeg = dx;
      if (bCondNegX < 0) {
        const phiXX0Neg = minmod(
          ls0L - 2*ls0C + ls0R,
          ls0C - 2*ls0L + ls0LL
        );
        const discrimXNeg = Math.pow(0.5*phiXX0Neg - ls0C - ls0L, 2) - 4*ls0C*ls0L;
        if (Math.abs(phiXX0Neg) > bEpsilon && discrimXNeg >= 0) {
          dxNeg = dx*(0.5 + (ls0C-ls0L-Math.sign(ls0C-ls0L)*Math.sqrt(discrimXNeg))/phiXX0Neg);
        }
        else {
          dxNeg = dx*(ls0C/(ls0C-ls0L+1e-6));
        }
        DxNegPhi = ((lsNC - 0)/(dxNeg+1e-6)) + 0.5*dxNeg*minmod(DxxPhi, DxxPhiNeg);
      }
      else {
        DxNegPhi = ((lsNC - lsNL)/dx) + 0.5*dx*minmod(DxxPhi, DxxPhiNeg);
      }
     
      let dyPos = dy;
      if (bCondPosY < 0) {
        const phiYY0Pos = minmod(
          ls0B - 2*ls0C + ls0T,
          ls0C - 2*ls0T + ls0TT
        );
        const discrimYPos = Math.pow(0.5*phiYY0Pos - ls0C - ls0T, 2) - 4*ls0C*ls0T;
        if (Math.abs(phiYY0Pos) > bEpsilon && discrimYPos >= 0) {
          dyPos = dy*(0.5 + (ls0C-ls0T-Math.sign(ls0C-ls0T)*Math.sqrt(discrimYPos))/phiYY0Pos);
        }
        else {
          dyPos = dy*(ls0C/(ls0C-ls0T+1e-6));
        }
        DyPosPhi = ((0 - lsNC)/(dyPos+1e-6)) - 0.5*dyPos*minmod(DyyPhi, DyyPhiPos);
      }
      else {
        DyPosPhi = ((lsNT - lsNC)/dy) - 0.5*dy*minmod(DyyPhi, DyyPhiPos);
      }

      let dyNeg = dy;
      if (bCondNegY < 0) {
        const phiYY0Neg = minmod(
          ls0B - 2*ls0C + ls0T,
          ls0C - 2*ls0B + ls0BB
        );
        const discrimYNeg = Math.pow(0.5*phiYY0Neg - ls0C - ls0B, 2) - 4*ls0C*ls0B;
        if (Math.abs(phiYY0Neg) > bEpsilon && discrimYNeg >= 0) {
          dyNeg = dy*(0.5 + (ls0C-ls0B-Math.sign(ls0C-ls0B)*Math.sqrt(discrimYNeg))/phiYY0Neg);
        }
        else {
          dyNeg = dy*(ls0C/(ls0C-ls0B+1e-6));
        }
        DyNegPhi = ((lsNC - 0)/(dyNeg+1e-6)) + 0.5*dyNeg*minmod(DyyPhi, DyyPhiNeg);
      }
      else {
        DyNegPhi = ((lsNC - lsNB)/dy) + 0.5*dy*minmod(DyyPhi, DyyPhiNeg);
      }

      let dzPos = dz;
      if (bCondPosZ < 0) {
        const phiZZ0Pos = minmod(
          ls0D - 2*ls0C + ls0U,
          ls0C - 2*ls0U + ls0UU
        );
        const discrimZPos = Math.pow(0.5*phiZZ0Pos - ls0C - ls0U, 2) - 4*ls0C*ls0U;
        if (Math.abs(phiZZ0Pos) > bEpsilon && discrimZPos >= 0) {
          dzPos = dz*(0.5 + (ls0C-ls0U-Math.sign(ls0C-ls0U)*Math.sqrt(discrimZPos))/phiZZ0Pos);
        }
        else {
          dzPos = dz*(ls0C/(ls0C-ls0U+1e-6));
        }
        DzPosPhi = ((0 - lsNC)/(dzPos+1e-6)) - 0.5*dzPos*minmod(DzzPhi, DzzPhiPos);
      }
      else {
        DzPosPhi = ((lsNU - lsNC)/dz) - 0.5*dz*minmod(DzzPhi, DzzPhiPos);
      }

      let dzNeg = dz;
      if (bCondNegZ < 0) {
        const phiZZ0Neg = minmod(
          ls0D - 2*ls0C + ls0U,
          ls0C - 2*ls0D + ls0DD
        );
        const discrimZNeg = Math.pow(0.5*phiZZ0Neg - ls0C - ls0D, 2) - 4*ls0C*ls0D;
        if (Math.abs(phiZZ0Neg) > bEpsilon && discrimZNeg >= 0) {
          dzNeg = dz*(0.5 + (ls0C-ls0D-Math.sign(ls0C-ls0D)*Math.sqrt(discrimZNeg))/phiZZ0Neg);
        }
        else {
          dzNeg = dz*(ls0C/(ls0C-ls0D+1e-6));
        }  
        DzNegPhi = ((lsNC - 0)/(dzNeg+1e-6)) + 0.5*dzNeg*minmod(DzzPhi, DzzPhiNeg);
      }
      else {
        DzNegPhi = ((lsNC - lsND)/dz) + 0.5*dz*minmod(DzzPhi, DzzPhiNeg);
      }

      const dt0 = dt;// 0.3*Math.min(dxPos, Math.min(dxNeg, Math.min(dyPos, Math.min(dyNeg, Math.min(dzPos, dzNeg)))));
      const GPhi = godunovH(sgnPhi0, DxPosPhi, DxNegPhi, DyPosPhi, DyNegPhi, DzPosPhi, DzNegPhi);
      return lsNC*damping + (1-damping)*(lsNC - dt0*sgnPhi0*(GPhi-1.0));

    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {
      dt: 'Float', levelSet0: 'Array', levelSetN: 'Array', boundaryBuf: 'Array', damping: 'Float'
    }});

    this.advectLiquidVelocity = this.gpu.createKernel(function(dt, vel0, boundaryBuf, damping) {
      const [x,y,z] = xyzLookup();
      const u = vel0[x][y][z];

      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY ||
          x < 1 || y < 1 || z < 1 || x > this.constants.N || y > this.constants.N || z > this.constants.N) { return [0,0,0]; }

      // Back-step the velocity to the sample point that the current cell value came from
      // then bilinearly interpolate that from the grid cells
      
      const xx = clampValue(x-dt*u[0], 0.5, this.constants.NPLUSAHALF);
      const yy = clampValue(y-dt*u[1], 0.5, this.constants.NPLUSAHALF);
      const zz = clampValue(z-dt*u[2], 0.5, this.constants.NPLUSAHALF);
      const i0 = Math.floor(xx), i1 = i0 + 1;
      const j0 = Math.floor(yy), j1 = j0 + 1;
      const k0 = Math.floor(zz), k1 = k0 + 1;
      const sx1 = xx-i0, sx0 = 1-sx1;
      const sy1 = yy-j0, sy0 = 1-sy1;
      const sz1 = zz-k0, sz0 = 1-sz1;

      const vel0i0j0k0 = vel0[i0][j0][k0], b000 = 1;//(1-boundaryBuf[i0][j0][k0]);
      const vel0i0j1k0 = vel0[i0][j1][k0], b010 = 1;//(1-boundaryBuf[i0][j1][k0]);
      const vel0i1j0k0 = vel0[i1][j0][k0], b100 = 1;//(1-boundaryBuf[i1][j0][k0]);
      const vel0i1j1k0 = vel0[i1][j1][k0], b110 = 1;//(1-boundaryBuf[i1][j1][k0]);
      const vel0i0j0k1 = vel0[i0][j0][k1], b001 = 1;//(1-boundaryBuf[i0][j0][k1]);
      const vel0i0j1k1 = vel0[i0][j1][k1], b011 = 1;//(1-boundaryBuf[i0][j1][k1]);
      const vel0i1j0k1 = vel0[i1][j0][k1], b101 = 1;//(1-boundaryBuf[i1][j0][k1]);
      const vel0i1j1k1 = vel0[i1][j1][k1], b111 = 1;//(1-boundaryBuf[i1][j1][k1]);

      const result = [0,0,0];
      for (let i = 0; i < 3; i++) {
        const v0 = sx0*(sy0*vel0i0j0k0[i]*b000 + sy1*vel0i0j1k0[i]*b010) + sx1*(sy0*vel0i1j0k0[i]*b100 + sy1*vel0i1j1k0[i]*b110);
        const v1 = sx0*(sy0*vel0i0j0k1[i]*b001 + sy1*vel0i0j1k1[i]*b011) + sx1*(sy0*vel0i1j0k1[i]*b101 + sy1*vel0i1j1k1[i]*b111);
        result[i] = sz0*v0 + sz1*v1;
      }
      return [
        damping*u[0] + (1-damping)*result[0],
        damping*u[1] + (1-damping)*result[1],
        damping*u[2] + (1-damping)*result[2]
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {
      dt: 'Float', vel0: 'Array3D(3)', boundaryBuf: 'Array', damping: 'Float'
    }});

    this.applyLiquidVorticity = this.gpu.createKernel(function(vel, boundaryBuf, levelSet) {
      const [x,y,z] = xyzLookup();
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return vel[x][y][z]; }

      const L = vel[clampm1(x)][y][z]; const R = vel[clampp1(x)][y][z];
      const B = vel[x][clampm1(y)][z]; const T = vel[x][clampp1(y)][z];
      const D = vel[x][y][clampm1(z)]; const U = vel[x][y][clampp1(z)];
      return [
        0.5 * ((T[2] - B[2]) - (U[1] - D[1])),
        0.5 * ((U[0] - D[0]) - (R[2] - L[2])),
        0.5 * ((R[1] - L[1]) - (T[0] - B[0]))
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes:{vel: 'Array3D(3)', boundaryBuf: 'Array', levelSet: 'Array'}});

    this.applyLiquidConfinement = this.gpu.createKernel(function(dt, epsilon, tempVec3, vel, boundaryBuf, levelSet) {
      const [x,y,z] = xyzLookup();
      let velxyz = vel[x][y][z];
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
        x > this.constants.N || y > this.constants.N || z > this.constants.N) { return velxyz; }

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
      dt: 'Float', epsilon: 'Float', tempVec3: 'Array3D(3)', vel: 'Array3D(3)', boundaryBuf: 'Array', levelSet: 'Array'
    }});

    this.computeLiquidVelDiv = this.gpu.createKernel(function(vel, levelSet, levelEpsilon, boundaryBuf) {
      const [x,y,z] = xyzLookup();

      if (levelSet[x][y][z] > 2 || boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
        x > this.constants.N || y > this.constants.N || z > this.constants.N) { return 0; }

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
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes:{
      vel:'Array3D(3)', levelSet: 'Array', levelEpsilon: 'Float', boundaryBuf:'Array'
    }});

    this.applyExternalForcesToLiquid = this.gpu.createKernel(function(dt, force, vel, levelSet, levelEpsilon, boundaryBuf) {
      const [x,y,z] = xyzLookup();
      const u = vel[x][y][z];

      if (levelSet[x][y][z] > levelEpsilon || boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
        x > this.constants.N || y > this.constants.N || z > this.constants.N) { return u; }

      const du = [dt * force[0], dt * force[1], dt * force[2]];
      return [
        clampValue(u[0] + du[0], -this.constants.MAX_ABS_SPD, this.constants.MAX_ABS_SPD), 
        clampValue(u[1] + du[1], -this.constants.MAX_ABS_SPD, this.constants.MAX_ABS_SPD), 
        clampValue(u[2] + du[2], -this.constants.MAX_ABS_SPD, this.constants.MAX_ABS_SPD)
      ];

    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {
      dt: 'Float', force: 'Array', vel: 'Array3D(3)', levelSet: 'Array', 
      levelEpsilon: 'Float', boundaryBuf: 'Array'
    }});

    this.jacobiLiquid = this.gpu.createKernel(function(pressure, tempScalar, boundaryBuf, levelSet, levelEpsilon) {
      const [x,y,z] = xyzLookup();
      const pC = pressure[x][y][z]; //heavisideP(levelSet[x][y][z], pressure[x][y][z], levelEpsilon);
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
        x > this.constants.N || y > this.constants.N || z > this.constants.N) { return pC; }

      //if (levelSet[x][y][z] > 0) { return pC; } // All of these levelSet ifs (and/or heaviside ops) cause the water to disappear

      const bC = tempScalar[x][y][z]; // Contains the 'divergence' calculated previously

      const xm1 = clampm1(x); const xp1 = clampp1(x);
      const ym1 = clampm1(y); const yp1 = clampp1(y);
      const zm1 = clampm1(z); const zp1 = clampp1(z);
    
      let pL = pressure[xm1][y][z];//heavisideP(levelSet[xm1][y][z], pressure[xm1][y][z], levelEpsilon);
      if (boundaryBuf[xm1][y][z] > this.constants.BOUNDARY) { pL = pC; }
 
      let pR = pressure[xp1][y][z];//heavisideP(levelSet[xp1][y][z], pressure[xp1][y][z], levelEpsilon);
      if (boundaryBuf[xp1][y][z] > this.constants.BOUNDARY) { pR = pC; }
 
      let pB = pressure[x][ym1][z];//heavisideP(levelSet[x][ym1][z], pressure[x][ym1][z], levelEpsilon);
      if (boundaryBuf[x][ym1][z] > this.constants.BOUNDARY) { pB = pC; }

      let pT = pressure[x][yp1][z];//heavisideP(levelSet[x][yp1][z], pressure[x][yp1][z], levelEpsilon);
      if (boundaryBuf[x][yp1][z] > this.constants.BOUNDARY) { pT = pC; }
  
      let pD = pressure[x][y][zm1];//heavisideP(levelSet[x][y][zm1], pressure[x][y][zm1], levelEpsilon);
      if (boundaryBuf[x][y][zm1] > this.constants.BOUNDARY) { pD = pC; }
  
      let pU = pressure[x][y][zp1]; //heavisideP(levelSet[x][y][zp1], pressure[x][y][zp1], levelEpsilon);
      if (boundaryBuf[x][y][zp1] > this.constants.BOUNDARY) { pU = pC; }

      return (pL + pR + pB + pT + pU + pD - bC) / 6.0;
      
    }, {...pipelineFuncSettings, returnType:'Float', argumentTypes: {
      pressure: 'Array', tempScalar: 'Array', boundaryBuf: 'Array', levelSet: 'Array', levelEpsilon: 'Float'
    }});

    this.projectLiquidVelocity = this.gpu.createKernel(function(pressure, vel, boundaryBuf, levelSet, levelEpsilon, modulate) {
      const [x,y,z] = xyzLookup();
      

      // NOTE: If the boundary has a velocity, return it here!
      if (boundaryBuf[x][y][z] > this.constants.BOUNDARY || x < 1 || y < 1 || z < 1 || 
        x > this.constants.N || y > this.constants.N || z > this.constants.N) { return [0,0,0]; }
 
      const xm1 = clampm1(x); const xp1 = clampp1(x);
      const ym1 = clampm1(y); const yp1 = clampp1(y);
      const zm1 = clampm1(z); const zp1 = clampp1(z);

      const lsC = levelSet[x][y][z];
      const lsL = levelSet[xm1][y][z], lsR = levelSet[xp1][y][z];
      const lsB = levelSet[x][ym1][z], lsT = levelSet[x][yp1][z];
      const lsD = levelSet[x][y][zm1], lsU = levelSet[x][y][zp1];

      const EPSILON = 1e-10;
      const pC = pressure[x][y][z];  
      const pL = pressure[xm1][y][z], pR = pressure[xp1][y][z];
      const pB = pressure[x][ym1][z], pT = pressure[x][yp1][z];
      const pD = pressure[x][y][zm1], pU = pressure[x][y][zp1];

      // NOTE: This requires augmentation if the boundaries have velocity!
      const obstV = [0,0,0];
      const vMask = [1,1,1];

      if (boundaryBuf[xm1][y][z] > this.constants.BOUNDARY) { pL = pC; obstV[0] = 0; vMask[0] = 0; }
      else { pL = heavisideP(lsL, pressure[xm1][y][z], EPSILON); }
      if (boundaryBuf[xp1][y][z] > this.constants.BOUNDARY) { pR = pC; obstV[0] = 0; vMask[0] = 0; }
      else { pR = heavisideP(lsR, pressure[xp1][y][z], EPSILON); }
      if (boundaryBuf[x][ym1][z] > this.constants.BOUNDARY) { pB = pC; obstV[1] = 0; vMask[1] = 0; }
      else { pB = heavisideP(lsB, pressure[x][ym1][z], EPSILON); }
      if (boundaryBuf[x][yp1][z] > this.constants.BOUNDARY) { pT = pC; obstV[1] = 0; vMask[1] = 0; }
      else { pT = heavisideP(lsT, pressure[x][yp1][z], EPSILON); }
      if (boundaryBuf[x][y][zm1] > this.constants.BOUNDARY) { pD = pC; obstV[2] = 0; vMask[2] = 0; }
      else { pD = heavisideP(lsD, pressure[x][y][zm1], EPSILON); }
      if (boundaryBuf[x][y][zp1] > this.constants.BOUNDARY) { pU = pC; obstV[2] = 0; vMask[2] = 0; }
      else { pU = heavisideP(lsU, pressure[x][y][zp1], EPSILON); }


      /*
      const dx = this.constants.DX, dy = this.constants.DY, dz = this.constants.DZ;
      const phiX = (lsR - lsL)/(2*dx), phiY = (lsT - lsB)/(2*dy), phiZ = (lsU - lsD)/(2*dz);
      const phiXX = (lsL-2*lsC+lsR)/(dx*dx), phiYY = (lsB-2*lsC+lsT)/(dy*dy), phiZZ = (lsD-2*lsC+lsU)/(dz*dz);
      const phiXY = (levelSet[xp1][yp1][z] - levelSet[xm1][yp1][z] - levelSet[xp1][ym1][z] + levelSet[xm1][ym1][z]) / (4*dx*dy);
      const phiXZ = (levelSet[xp1][y][zp1] - levelSet[xm1][y][zp1] - levelSet[xp1][y][zm1] + levelSet[xm1][y][zm1]) / (4*dx*dz);


      const nLen = 1.0 / (Math.sqrt(phiX*phiX + phiY*phiY + phiZ*phiZ) + 1e-6);
      const n = [phiX/nLen, phiY/nLen, phiZ/nLen];
        */

      const velxyz = vel[x][y][z];
      const vNew = [
        velxyz[0] - modulate * (0.5 * (pR - pL) - surfaceN[0]*kCurv), 
        velxyz[1] - modulate * (0.5 * (pT - pB) - surfaceN[0]*kCurv), 
        velxyz[2] - modulate * (0.5 * (pU - pD) - surfaceN[0]*kCurv)
      ];
      return [vMask[0]*vNew[0]+obstV[0], vMask[1]*vNew[1]+obstV[1], vMask[2]*vNew[2]+obstV[2]];
    }, {...pipelineFuncSettings, returnType:'Array(3)', argumentTypes: {
      pressure:'Array', vel:'Array3D(3)', boundaryBuf:'Array', levelSet: 'Array', 
      levelEpsilon: 'Float', modulate: 'Float'
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

  initSimpleWaterKernels(nPlus2, unitSize, constants) {
    if (this._simpleWaterInit) { return; }
    const allConstants = {...constants,
      N: nPlus2-2, NPLUSAHALF: nPlus2-1.5, 
      NPLUS1: nPlus2-1, NPLUS2: nPlus2, NDIM:3, 
      unitSize: unitSize, unitArea: unitSize*unitSize,
      unitVolume: unitSize*unitSize*unitSize,
    };

    const settings = {
      output: [nPlus2, nPlus2, nPlus2],
      pipeline: true,
      immutable: true,
      constants: allConstants
    };
    this.gpu.addFunction(function xyzLookup() {
      return [this.thread.z, this.thread.y, this.thread.x];
    });
    this.gpu.addFunction(function cellLiquidVol(cell) {
      return cell[this.constants.CELL_VOL_IDX];
    });
    this.gpu.addFunction(function cellType(cell) {
      return cell[this.constants.CELL_TYPE_IDX];
    });
    this.gpu.addFunction(function cellSettled(cell) {
      return cell[this.constants.CELL_SETTLED_IDX];
    });
    this.gpu.addFunction(function absCSFlow(ui) {
      return Math.abs(ui * this.constants.unitArea);
    });

    this.buildSimpleWaterBufferScalar = this.gpu.createKernel(function() {
      return 0;
    }, {...settings, returnType:'Float'});
    this.buildSimpleWaterBufferVec3 = this.gpu.createKernel(function() {
      return [0,0,0];
    }, {...settings, returnType:'Array(3)'});
    this.buildSimpleWaterBufferVec4 = this.gpu.createKernel(function() {
      return [0,0,0,0];
    }, {...settings, returnType:'Array(4)'});
    this.buildSimpleWaterCellBuffer = this.gpu.createKernel(function() {
      const [x,y,z] = xyzLookup();
      // Set the boundaries along the outside in all dimensions
      if (z < 1 || z > this.constants.N || y < 1 || y > this.constants.N || x < 1 || x > this.constants.N) { 
        return [0, this.constants.SOLID_CELL_TYPE, 0];
      }
      if (y === 24 && (x >= 15 && x <= this.constants.N) && (z >= 0 && z <= this.constants.N)) {
        return [0, this.constants.SOLID_CELL_TYPE, 0];
      }
      if (y === 15 && (x >= 0 && x <= 15) && (z >= 0 && z <= this.constants.N)) {
        return [0, this.constants.SOLID_CELL_TYPE, 0];
      }

      if ((x === 5 || x === 26) && (y >= 3 && y <= 10)) {
        return [0, this.constants.SOLID_CELL_TYPE, 0];
      }
      // Add liquid to the top
      if (x >= 1 && x <= this.constants.N && y >= this.constants.N-3 && y <= this.constants.N &&
          z >= 1 && z <= this.constants.N) {
        return [this.constants.unitVolume, this.constants.EMPTY_CELL_TYPE, 0];
      }

      // ...otherwise it's just an empty cell
      return [0, this.constants.EMPTY_CELL_TYPE, 0];

    }, {...settings, returnType:'Array(3)'});

    const VEL_TYPE  = 'Array3D(3)';
    const CELL_TYPE = 'Array3D(3)';

    this.simpleWaterAdvectVel = this.gpu.createKernel(function(dt, vel, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      const u = vel[x][y][z];
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { 
        return [0,0,0]; 
      }
      const xx = clampValue(x-dt*u[0], 0.5, this.constants.NPLUSAHALF);
      const yy = clampValue(y-dt*u[1], 0.5, this.constants.NPLUSAHALF);
      const zz = clampValue(z-dt*u[2], 0.5, this.constants.NPLUSAHALF);
      const i0 = Math.floor(xx), i1 = i0 + 1;
      const j0 = Math.floor(yy), j1 = j0 + 1;
      const k0 = Math.floor(zz), k1 = k0 + 1;
      const sx1 = xx-i0, sx0 = 1-sx1;
      const sy1 = yy-j0, sy0 = 1-sy1;
      const sz1 = zz-k0, sz0 = 1-sz1;
      const vel000 = vel[i0][j0][k0], vel010 = vel[i0][j1][k0];
      const vel100 = vel[i1][j0][k0], vel110 = vel[i1][j1][k0];
      const vel001 = vel[i0][j0][k1], vel011 = vel[i0][j1][k1];
      const vel101 = vel[i1][j0][k1], vel111 = vel[i1][j1][k1];
      const result = [0,0,0];
      for (let i = 0; i < 3; i++) {
        const v0 = sx0*(sy0*vel000[i] + sy1*vel010[i]) + sx1*(sy0*vel100[i] + sy1*vel110[i]);
        const v1 = sx0*(sy0*vel001[i] + sy1*vel011[i]) + sx1*(sy0*vel101[i] + sy1*vel111[i]);
        result[i] = sz0*v0 + sz1*v1;
      }
      return result;
    }, {...settings, returnType:'Array(3)', argumentTypes:{dt:'Float', vel:VEL_TYPE, cellData:CELL_TYPE}});

    this.simpleWaterApplyExtForces = this.gpu.createKernel(function(dt, gravity, vel, cellData) {
      const [x,y,z] = xyzLookup();

      // Boundary condition - no forces are applied outside of the liquid
      const cell = cellData[x][y][z];
      const cellLiquidVol = cellLiquidVol(cell);
      const u = vel[x][y][z];
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N || 
          Math.abs(cellLiquidVol) < this.constants.LIQUID_EPSILON) { 
        return u; 
      }
      
      const result = [u[0], u[1], u[2]];
      const ym1 = clampm1(y);

      // Apply Gravity
      const bCell = cellData[x][ym1][z];
      const bCellType = cellType(bCell);
      result[1] = clampValue(result[1] - gravity*dt, -this.constants.MAX_GRAVITY_VEL, this.constants.MAX_GRAVITY_VEL);

      // Determine the hydrostatic pressure = density*gravity*(height of the fluid above 
      // How much pressure is pressing down on this cell?
      let liquidVolAboveCell = 0;
      const pressureHeightIdx = Math.min(this.constants.N, y+1+this.constants.PRESSURE_MAX_HEIGHT);
      for (let i = y+1; i < pressureHeightIdx; i++) {
        const aboveCell = cellData[x][i][z];
        const aboveCellType = cellType(aboveCell);
        const aboveCellVol = cellLiquidVol(aboveCell);
        if (aboveCellType === this.constants.SOLID_CELL_TYPE || 
            aboveCellVol < this.constants.LIQUID_EPSILON) { break; }
        liquidVolAboveCell += aboveCellVol;
      }
      const liquidMassAboveCell = this.constants.LIQUID_DENSITY*liquidVolAboveCell;
      const hsForce = this.constants.ATMO_PRESSURE*this.constants.unitArea + liquidMassAboveCell*gravity;
      const dHSVel  = hsForce*dt;

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const zm1 = clampm1(z), zp1 = clampp1(z);
      const cellL = cellData[xm1][y][z];
      const cellR = cellData[xp1][y][z];
      const cellD = cellData[x][y][zm1];
      const cellU = cellData[x][y][zp1];
      const bCellLiquidVol = cellLiquidVol(bCell);

      let totalVelX = 0, totalVelZ = 0;
      if (bCellType === this.constants.SOLID_CELL_TYPE || bCellLiquidVol >= cellLiquidVol) {
        totalVelX -= (cellType(cellL) === this.constants.EMPTY_CELL_TYPE && 
                      cellLiquidVol(cellL) < cellLiquidVol) ? dHSVel : 0;
        totalVelX += (cellType(cellR) === this.constants.EMPTY_CELL_TYPE && 
                      cellLiquidVol(cellR) < cellLiquidVol) ? dHSVel : 0;
        totalVelZ -= (cellType(cellD) === this.constants.EMPTY_CELL_TYPE &&
                      cellLiquidVol(cellD) < cellLiquidVol) ? dHSVel : 0;
        totalVelZ += (cellType(cellU) === this.constants.EMPTY_CELL_TYPE &&
                      cellLiquidVol(cellU) < cellLiquidVol) ? dHSVel : 0;
      }
      result[0] = clampValue(result[0] + totalVelX, -this.constants.MAX_PRESSURE_VEL, this.constants.MAX_PRESSURE_VEL);
      result[2] = clampValue(result[2] + totalVelZ, -this.constants.MAX_PRESSURE_VEL, this.constants.MAX_PRESSURE_VEL);
      
      // Friction hack
      const FRICTION_AMT = 15;
      const frictionVelX = dt*FRICTION_AMT;
      const frictionVelZ = dt*FRICTION_AMT;
      result[0] = result[0] < 0 ? Math.min(0, result[0] + frictionVelX) : Math.max(0, result[0] - frictionVelX); 
      result[2] = result[2] < 0 ? Math.min(0, result[2] + frictionVelZ) : Math.max(0, result[2] - frictionVelZ);

      return result;

    }, {...settings, returnType:'Array(3)', argumentTypes:{
      dt:'Float', gravity:'Float', vel:VEL_TYPE, cellData:CELL_TYPE
    }});

    this.simpleWaterInjectForceBlob = this.gpu.createKernel(function(center, impulseStrength, size, vel, cellData) {
      const [x,y,z] = xyzLookup();

      // Boundary condition - no forces are applied outside of the liquid
      const cell = cellData[x][y][z];
      const cellLiquidVol = cellLiquidVol(cell);
      const u = vel[x][y][z];
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { 
        return u;
      }

      const mass = cellLiquidVol*this.constants.LIQUID_DENSITY;
      const force = impulseStrength*mass;

      const dir = [x-center[0], y-center[1], z-center[2]];
      const len = length3(dir);
      return len > size ? u : [u[0] + force*dir[0], u[1] + force*dir[1], u[2] + force*dir[2]];
    }, {...settings, returnType: 'Array(3)', argumentTypes: {
      center: 'Array', impulseStrength: 'Float', size: 'Float', vel:VEL_TYPE, cellData:CELL_TYPE
    }});

    this.simpleWaterCurl = this.gpu.createKernel(function(vel, cellData) {
      const [x,y,z] = xyzLookup();

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);

      const L = vel[xm1][y][z], R = vel[xp1][y][z];
      const B = vel[x][ym1][z], T = vel[x][yp1][z];
      const D = vel[x][y][zm1], U = vel[x][y][zp1];

      return [
        ((T[2] - B[2]) - (U[1] - D[1])) / (2*this.constants.unitSize),
        ((U[0] - D[0]) - (R[2] - L[2])) / (2*this.constants.unitSize),
        ((R[1] - L[1]) - (T[0] - B[0])) / (2*this.constants.unitSize)
      ];
    }, {...settings, returnType:'Array(3)', argumentTypes:{vel:VEL_TYPE, cellData:CELL_TYPE}});

    this.simpleWaterCurlLen = this.gpu.createKernel(function(curl) {
      const [x,y,z] = xyzLookup();
      return length3(curl[x][y][z]);
    }, {...settings, returnType:'Float', argumentTypes:{curl:'Array3D(3)'}});

    this.simpleWaterApplyVC = this.gpu.createKernel(function(dtVC, vel, cellData, curl, curlLen) {
      const [x,y,z] = xyzLookup();

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);
      
      const omega  = curl[x][y][z];
      const omegaL = curlLen[xm1][y][z], omegaR = curlLen[xp1][y][z];
      const omegaB = curlLen[x][ym1][z], omegaT = curlLen[x][yp1][z];
      const omegaD = curlLen[x][y][zm1], omegaU = curlLen[x][y][zp1];

      const eta = [
        (omegaR - omegaL) / (2*this.constants.unitSize),
        (omegaT - omegaB) / (2*this.constants.unitSize), 
        (omegaU - omegaD) / (2*this.constants.unitSize)
      ];
      const etaLen = length3(eta) + 1e-10;
      eta[0] /= etaLen; eta[1] /= etaLen; eta[2] /= etaLen;
      const u = vel[x][y][z];
      return [
        u[0] + dtVC * (eta[0]*omega[2] - eta[2]*omega[1]),
        u[1] + dtVC * (eta[2]*omega[0] - eta[0]*omega[2]),
        u[2] + dtVC * (eta[0]*omega[1] - eta[1]*omega[0])
      ];
    }, {...settings, returnType:'Array(3)', argumentTypes:{
      dtVC:'Float', vel:VEL_TYPE, cellData:CELL_TYPE, curl:'Array3D(3)', curlLen:'Array'
    }});

    this.simpleWaterDiv = this.gpu.createKernel(function(vel, cellData) {
      const [x,y,z] = xyzLookup();

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);

      const cL = cellData[xm1][y][z], cR = cellData[xp1][y][z];
      const cB = cellData[x][ym1][z], cT = cellData[x][yp1][z];
      const cD = cellData[x][y][zm1], cU = cellData[x][y][zp1];

      // NOTE: If the boundary has a velocity then change noVel to that velocity!
      const noVel = [0,0,0];
      const fieldL = (cellType(cL) === this.constants.SOLID_CELL_TYPE) ? noVel : vel[xm1][y][z];
      const fieldR = (cellType(cR) === this.constants.SOLID_CELL_TYPE) ? noVel : vel[xp1][y][z];
      const fieldB = (cellType(cB) === this.constants.SOLID_CELL_TYPE) ? noVel : vel[x][ym1][z];
      const fieldT = (cellType(cT) === this.constants.SOLID_CELL_TYPE) ? noVel : vel[x][yp1][z];
      const fieldD = (cellType(cD) === this.constants.SOLID_CELL_TYPE) ? noVel : vel[x][y][zm1];
      const fieldU = (cellType(cU) === this.constants.SOLID_CELL_TYPE) ? noVel : vel[x][y][zp1];
      return ((fieldR[0]-fieldL[0]) + (fieldT[1]-fieldB[1]) + (fieldU[2]-fieldD[2])) / 
        (this.constants.NDIM*this.constants.N);

    }, {...settings, returnType:'Float', argumentTypes:{vel:VEL_TYPE, cellData:CELL_TYPE}});

    this.simpleWaterComputePressure = this.gpu.createKernel(function(pressure, cellData, div) {
      // NOTE: The pressure buffer MUST be cleared before calling this!!
      const [x,y,z] = xyzLookup();
      const pC = pressure[x][y][z];
      const cell = cellData[x][y][z];
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return pC; }
      if (Math.abs(cellLiquidVol(cell)) < this.constants.LIQUID_EPSILON) { return 0; } 

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);

      const cL = cellData[xm1][y][z], cR = cellData[xp1][y][z];
      const cB = cellData[x][ym1][z], cT = cellData[x][yp1][z];
      const cD = cellData[x][y][zm1], cU = cellData[x][y][zp1];

      const bC = div[x][y][z]; // Contains the 'divergence' calculated previously
      const pL = (cellType(cL) === this.constants.SOLID_CELL_TYPE) ? pC : pressure[xm1][y][z];
      const pR = (cellType(cR) === this.constants.SOLID_CELL_TYPE) ? pC : pressure[xp1][y][z];
      const pB = (cellType(cB) === this.constants.SOLID_CELL_TYPE) ? pC : pressure[x][ym1][z];
      const pT = (cellType(cT) === this.constants.SOLID_CELL_TYPE) ? pC : pressure[x][yp1][z];
      const pD = (cellType(cD) === this.constants.SOLID_CELL_TYPE) ? pC : pressure[x][y][zm1];
      const pU = (cellType(cU) === this.constants.SOLID_CELL_TYPE) ? pC : pressure[x][y][zp1];

      return (pL + pR + pB + pT + pU + pD - bC) / 6.0;

    }, {...settings, returnType:'Float', argumentTypes:{pressure:'Array', cellData:CELL_TYPE, div:'Array'}});

    this.simpleWaterProjVel = this.gpu.createKernel(function(pressure, vel, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return [0,0,0]; }

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);

      const cL = cellData[xm1][y][z], cR = cellData[xp1][y][z];
      const cB = cellData[x][ym1][z], cT = cellData[x][yp1][z];
      const cD = cellData[x][y][zm1], cU = cellData[x][y][zp1];

      const u = vel[x][y][z];
      const pC = pressure[x][y][z];  
      let pL = pressure[xm1][y][z], pR = pressure[xp1][y][z];
      let pB = pressure[x][ym1][z], pT = pressure[x][yp1][z];
      let pD = pressure[x][y][zm1], pU = pressure[x][y][zp1];

      // NOTE: This requires augmentation if the boundaries have velocity!
      const vMaskPos = [1,1,1];
      const vMaskNeg = [1,1,1];
      if (cellType(cL) === this.constants.SOLID_CELL_TYPE || cellSettled(cL) === 1) { pL = pC; vMaskNeg[0] = 0; }
      if (cellType(cR) === this.constants.SOLID_CELL_TYPE || cellSettled(cR) === 1) { pR = pC; vMaskPos[0] = 0; }
      if (cellType(cB) === this.constants.SOLID_CELL_TYPE || cellSettled(cB) === 1) { pB = pC; vMaskNeg[1] = 0; }
      if (cellType(cT) === this.constants.SOLID_CELL_TYPE || cellSettled(cT) === 1) { pT = pC; vMaskPos[1] = 0; }
      if (cellType(cD) === this.constants.SOLID_CELL_TYPE || cellSettled(cD) === 1) { pD = pC; vMaskNeg[2] = 0; }
      if (cellType(cU) === this.constants.SOLID_CELL_TYPE || cellSettled(cU) === 1) { pU = pC; vMaskPos[2] = 0; }

      const result = [
        u[0] - (pR-pL) / (this.constants.NDIM*this.constants.N),
        u[1] - (pT-pB) / (this.constants.NDIM*this.constants.N),
        u[2] - (pU-pD) / (this.constants.NDIM*this.constants.N)
      ];
      result[0] = Math.min(result[0]*vMaskPos[0], Math.max(result[0]*vMaskNeg[0], result[0]));
      result[1] = Math.min(result[1]*vMaskPos[1], Math.max(result[1]*vMaskNeg[1], result[1]));
      result[2] = Math.min(result[2]*vMaskPos[2], Math.max(result[2]*vMaskNeg[2], result[2]));
      return result;

    }, {...settings, returnType:'Array(3)', argumentTypes:{
      pressure:'Array', vel:VEL_TYPE, cellData:CELL_TYPE
    }});

    this.simpleWaterDiffuseVel = this.gpu.createKernel(function(vel0, vel, cellData, a) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N || 
          Math.abs(cellLiquidVol(cell)) < this.constants.LIQUID_EPSILON) {
        return [0,0,0];
      }
      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);
      
      const u  = vel[x][y][z];
      const u0 = vel0[x][y][z];
      
      const uxNeg = (cellType(cellData[xm1][y][z]) === this.constants.SOLID_CELL_TYPE) ? u : vel[xm1][y][z];
      const uxPos = (cellType(cellData[xp1][y][z]) === this.constants.SOLID_CELL_TYPE) ? u : vel[xp1][y][z];
      const uyNeg = (cellType(cellData[x][ym1][z]) === this.constants.SOLID_CELL_TYPE) ? u : vel[x][ym1][z];
      const uyPos = (cellType(cellData[x][yp1][z]) === this.constants.SOLID_CELL_TYPE) ? u : vel[x][yp1][z];
      const uzNeg = (cellType(cellData[x][y][zp1]) === this.constants.SOLID_CELL_TYPE) ? u : vel[x][y][zm1];
      const uzPos = (cellType(cellData[x][y][zm1]) === this.constants.SOLID_CELL_TYPE) ? u : vel[x][y][zp1];

      const divisor = 1.0 + 6.0*a;
      const result = [0,0,0];
      for (let i = 0; i < 3; i++) {
        result[i] = (u0[i] + a*(uxNeg[i] + uxPos[i] + uyNeg[i] + uyPos[i] + uzNeg[i] + uzPos[i])) / divisor;
      }
      return result;

    }, {...settings, returnType:'Array(3)', argumentTypes:{
      vel0:VEL_TYPE, vel:VEL_TYPE, cellData:CELL_TYPE, a:'Float'
    }});

    this.gpu.addFunction(function simpleWaterFlowHelperLRDU(dt, vel, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      const liquidVol = cellLiquidVol(cell);
      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);
      const u = vel[x][y][z];
      const cL = cellData[xm1][y][z], cR = cellData[xp1][y][z];
      const cB = cellData[x][ym1][z];
      const cD = cellData[x][y][zm1], cU = cellData[x][y][zp1];
      const liquidVolL = cellLiquidVol(cL), liquidVolR = cellLiquidVol(cR);
      const liquidVolB = cellLiquidVol(cB);
      const liquidVolD = cellLiquidVol(cD), liquidVolU = cellLiquidVol(cU);
      const typeL = cellType(cL), typeR = cellType(cR);
      const typeB = cellType(cB);
      const typeD = cellType(cD), typeU = cellType(cU);

      const absCSFlowL = absCSFlow(Math.min(0, u[0]));
      const absCSFlowR = absCSFlow(Math.max(0, u[0]));
      const absCSFlowD = absCSFlow(Math.min(0, u[2]));
      const absCSFlowU = absCSFlow(Math.max(0, u[2]));

      let flowToL = clampValue(this.constants.unitVolume * absCSFlowL * dt, 0, liquidVol);
      let flowToR = clampValue(this.constants.unitVolume * absCSFlowR * dt, 0, liquidVol);
      let flowToD = clampValue(this.constants.unitVolume * absCSFlowD * dt, 0, liquidVol);
      let flowToU = clampValue(this.constants.unitVolume * absCSFlowU * dt, 0, liquidVol);

      let maskL = 1, maskR = 1, maskD = 1, maskU = 1;

      // Can we flow left?
      if (liquidVolL >= this.constants.unitVolume || liquidVolL >= liquidVol || 
          typeL === this.constants.SOLID_CELL_TYPE || 
          (typeB === this.constants.EMPTY_CELL_TYPE && liquidVolB < liquidVol)) {
        // No flow leftward
        const flowToLDiv = flowToL/3; 
        flowToR += flowToLDiv;
        flowToU += flowToLDiv;
        flowToD += flowToLDiv;
        maskL = 0;
      }
      // Can we flow right?
      if (liquidVolR >= this.constants.unitVolume || liquidVolR >= liquidVol || 
          typeR === this.constants.SOLID_CELL_TYPE || 
          (typeB === this.constants.EMPTY_CELL_TYPE && liquidVolB < liquidVol)) {
        // No flow rightward
        const flowToRDiv = flowToR/3; 
        flowToL += flowToRDiv;
        flowToU += flowToRDiv;
        flowToD += flowToRDiv;
        maskR = 0;
      }
      // Can we flow back?
      if (liquidVolD >= this.constants.unitVolume || liquidVolD >= liquidVol || 
          typeD === this.constants.SOLID_CELL_TYPE || 
          (typeB === this.constants.EMPTY_CELL_TYPE && liquidVolB < liquidVol)) {
        // No flow backward
        const flowToDDiv = flowToD/3; 
        flowToL += flowToDDiv;
        flowToR += flowToDDiv;
        flowToU += flowToDDiv;
        maskD = 0;
      }
      // Can we flow forward?
      if (liquidVolU >= this.constants.unitVolume || liquidVolU >= liquidVol || 
          typeU === this.constants.SOLID_CELL_TYPE || 
          (typeB === this.constants.EMPTY_CELL_TYPE && liquidVolB < liquidVol)) {
        // No flow forward
        const flowToUDiv = flowToU/3; 
        flowToL += flowToUDiv;
        flowToR += flowToUDiv;
        flowToD += flowToUDiv;
        maskU = 0;
      }

      flowToL *= maskL; flowToR *= maskR;
      flowToD *= maskD; flowToU *= maskU;
      return [flowToL, flowToR, flowToD, flowToU];
    }, {returnType:'Array(4)'});

    this.gpu.addFunction(function simpleWaterFlowHelperBT(dt, vel, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      const liquidVol = cellLiquidVol(cell);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const u = vel[x][y][z];
      const cB = cellData[x][ym1][z], cT = cellData[x][yp1][z];
      const liquidVolB = cellLiquidVol(cB), liquidVolT = cellLiquidVol(cT);
      const typeB = cellType(cB), typeT = cellType(cT);
      const absCSFlowB = absCSFlow(Math.min(0, u[1]));
      const absCSFlowT = absCSFlow(Math.max(0, u[1]));
      let flowToB = clampValue(this.constants.unitVolume * absCSFlowB * dt, 0, liquidVol);
      let flowToT = clampValue((liquidVol-liquidVolT) * (6+absCSFlowT) * dt, 0, liquidVol); // Yup, this is a hack, it just works.
      let maskT = 1, maskB = 1;

      // Can we flow down?
      if (liquidVolB >= this.constants.unitVolume || typeB === this.constants.SOLID_CELL_TYPE) {
        // No flow downward
        maskB = 0;
      }
      // Can we flow up?
      if (liquidVolT >= liquidVol || typeT === this.constants.SOLID_CELL_TYPE) {
        // No flow upward
        maskT = 0;
      }
      flowToB *= maskB; flowToT *= maskT;
      return [flowToB, flowToT];

    }, {returnType:'Array(2)'});

    this.simpleWaterCalcFlowsLRB = this.gpu.createKernel(function(dt, vel, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      const liquidVol = cellLiquidVol(cell);
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || liquidVol === 0 || 
          x < 1 || y < 1 || z < 1 || x > this.constants.N || y > this.constants.N || z > this.constants.N ||
          cellSettled(cell) === 1) { return [0,0,0]; }

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y);
      const cL = cellData[xm1][y][z], cR = cellData[xp1][y][z];
      const cB = cellData[x][ym1][z];
      const liquidVolB = cellLiquidVol(cB);
      const liquidVolL = cellLiquidVol(cL), liquidVolR = cellLiquidVol(cR);

      const [flowToL, flowToR, flowToD, flowToU] = simpleWaterFlowHelperLRDU(dt, vel, cellData);
      const [flowToB, flowToT] = simpleWaterFlowHelperBT(dt, vel, cellData);
      const totalFlow = (flowToL+flowToR+flowToB+flowToT+flowToD+flowToU)+1e-6;

      return [
        Math.min(Math.max(0.5*(liquidVol-liquidVolL),0), Math.min(liquidVol*(flowToL/totalFlow), flowToL)),
        Math.min(Math.max(0.5*(liquidVol-liquidVolR),0), Math.min(liquidVol*(flowToR/totalFlow), flowToR)),
        Math.min(0.5*(liquidVol+liquidVolB), Math.min(liquidVol*(flowToB/totalFlow), flowToB))
      ];
    }, {...settings, returnType:'Array(3)', argumentTypes:{dt:'Float', vel:VEL_TYPE, cellData:CELL_TYPE }});

    this.simpleWaterCalcFlowsDUT = this.gpu.createKernel(function(dt, vel, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      const liquidVol = cellLiquidVol(cell);
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || liquidVol === 0 || 
          x < 1 || y < 1 || z < 1 || x > this.constants.N || y > this.constants.N || z > this.constants.N ||
          cellSettled(cell) === 1) { return [0,0,0]; }

      const zm1 = clampm1(z), zp1 = clampp1(z);
      const yp1 = clampp1(y);
      const cD = cellData[x][y][zm1], cU = cellData[x][y][zp1];
      const cT = cellData[x][yp1][z];
      const liquidVolT = cellLiquidVol(cT);
      const liquidVolD = cellLiquidVol(cD), liquidVolU = cellLiquidVol(cU);

      const [flowToL, flowToR, flowToD, flowToU] = simpleWaterFlowHelperLRDU(dt, vel, cellData);
      const [flowToB, flowToT] = simpleWaterFlowHelperBT(dt, vel, cellData);
      const totalFlow = (flowToL+flowToR+flowToB+flowToT+flowToD+flowToU)+1e-6;

      return [
        Math.min(Math.max(0.5*(liquidVol-liquidVolD),0), Math.min(liquidVol*(flowToD/totalFlow), flowToD)),
        Math.min(Math.max(0.5*(liquidVol-liquidVolU),0), Math.min(liquidVol*(flowToU/totalFlow), flowToU)),
        Math.min(Math.max(0.5*(liquidVol-liquidVolT),0), Math.min(liquidVol*(flowToT/totalFlow), flowToT))
      ];
    }, {...settings, returnType:'Array(3)', argumentTypes:{dt:'Float', vel:VEL_TYPE, cellData:CELL_TYPE }});

    this.simpleWaterSumFlows = this.gpu.createKernel(function(cellFlowsLRB, cellFlowsDUT, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return 0; }

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);

      const fC_LRB = cellFlowsLRB[x][y][z],   fC_DUT = cellFlowsDUT[x][y][z];
      const fL_LRB = cellFlowsLRB[xm1][y][z], fR_LRB = cellFlowsLRB[xp1][y][z];
      const fB_DUT = cellFlowsDUT[x][ym1][z], fT_LRB = cellFlowsLRB[x][yp1][z];
      const fD_DUT = cellFlowsDUT[x][y][zm1], fU_DUT = cellFlowsDUT[x][y][zp1];

      // The total volume change in this cell is equal to all the incoming flows
      // from neighbour cells minus the total outward flow from the current cell
      return (
        (fL_LRB[1] + fR_LRB[0] + fB_DUT[2] + fD_DUT[1] + fU_DUT[0] + fT_LRB[2]) - 
        (fC_LRB[0] + fC_LRB[1] + fC_LRB[2] + fC_DUT[0] + fC_DUT[1] + fC_DUT[2])
      );
      
    }, {...settings, returnType:'Float', argumentTypes:{
      cellFlowsLRB: 'Array3D(3)', cellFlowsDUT: 'Array3D(3)', cellData:CELL_TYPE
    }});

    this.simpleWaterAdjustFlows = this.gpu.createKernel(function(cellFlowSums, cellData) {
      const [x,y,z] = xyzLookup();
      const cell = cellData[x][y][z];
      if (cellType(cell) === this.constants.SOLID_CELL_TYPE || x < 1 || y < 1 || z < 1 || 
          x > this.constants.N || y > this.constants.N || z > this.constants.N) { return cell; }

      const xm1 = clampm1(x), xp1 = clampp1(x);
      const ym1 = clampm1(y), yp1 = clampp1(y);
      const zm1 = clampm1(z), zp1 = clampp1(z);
      let sC = cellFlowSums[x][y][z];
      const sL = cellFlowSums[xm1][y][z], sR = cellFlowSums[xp1][y][z];
      const sB = cellFlowSums[x][ym1][z], sT = cellFlowSums[x][yp1][z];
      const sD = cellFlowSums[x][y][zm1], sU = cellFlowSums[x][y][zp1];
      
      const liquidVol = cell[this.constants.CELL_VOL_IDX];

      const finalVol = (liquidVol + sC);
      cell[this.constants.CELL_VOL_IDX] = (Math.abs(finalVol) < this.constants.LIQUID_EPSILON) ? 0 : finalVol;

      // Unsettle the cell if there are any changes in the neighbour cell flows
      if (Math.abs(sL) >= this.constants.LIQUID_EPSILON || Math.abs(sR) >= this.constants.LIQUID_EPSILON ||
          Math.abs(sB) >= this.constants.LIQUID_EPSILON || Math.abs(sT) >= this.constants.LIQUID_EPSILON ||
          Math.abs(sD) >= this.constants.LIQUID_EPSILON || Math.abs(sU) >= this.constants.LIQUID_EPSILON) {
        cell[this.constants.CELL_SETTLED_IDX] = 0;
      }
      else {
        // If there's no change in flow then the cell becomes settled
        cell[this.constants.CELL_SETTLED_IDX] = (Math.abs(sC) < this.constants.LIQUID_EPSILON && 
          Math.abs(liquidVol) < this.constants.LIQUID_EPSILON || 
          Math.abs(liquidVol-this.constants.unitVolume) < this.constants.LIQUID_EPSILON) ? 1 : 0;
      }
      return cell;

    }, {...settings, returnType:'Array(3)', argumentTypes:{
      cellFlowSums: 'Array', cellData:CELL_TYPE
    }});


    this._simpleWaterInit = true;
  }

}

export default GPUKernelManager;