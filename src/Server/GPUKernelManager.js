
import {GPU} from 'gpu.js';
import {VOXEL_ERR_UNITS} from '../MathUtils';
import {FIRE_SPECTRUM_WIDTH} from '../Spectrum';

class GPUKernelManager {
  constructor(gridSize) {
    this.gpu = new GPU({mode: 'headlessgl'});;

    this.gpu.addFunction(function clampValue(value, min, max) {
      return Math.min(max, Math.max(min, value));
    });

    this.pipelineFuncSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true, // We use pipelining for most things in order to get a texture output from kernels
      constants: {
        VOXEL_ERR_UNITS_SQR: VOXEL_ERR_UNITS*VOXEL_ERR_UNITS,
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
}

export default GPUKernelManager;