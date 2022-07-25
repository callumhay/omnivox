import {GPU} from 'gpu.js';

import VoxelConstants from '../VoxelConstants';
import {FIRE_SPECTRUM_WIDTH} from '../Spectrum';

class GPUKernelManager {
  constructor(gridSize) {
    this.gpu = new GPU({mode: 'gpu'});

    this.gpu.addFunction(function clampValue(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }, {name: 'clampValue'});

    this.gpu.addFunction(function whiteNoise3dTo1d(value3d) {
      const smallValue = [Math.sin(value3d[0]), Math.sin(value3d[1]), Math.sin(value3d[2])];      // Make the value smaller to avoid artfacts
      const randomScalar = (smallValue[0]*12.9898 + smallValue[1]*78.233 + smallValue[2]*37.719); // Get a scalar from the 3D value
      const fullValue = (Math.sin(randomScalar) * 143758.5453);
      return fullValue % 1.0;// - Math.floor(fullValue); // Make the value more random by making it bigger and then taking the factional part
    }, {name: 'whiteNoise3dTo1d', returnType: "Float", argumentTypes: {value3d: "Array(3)"}});

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
    }, {...this.pipelineFuncSettings, name:'clearFunc', immutable: false, argumentTypes: {colour: 'Array(3)'}});

    // Framebuffer combination kernels
    this.addFramebuffersFunc = this.gpu.createKernel(function(framebufTexA, framebufTexB) {
      const fbAVoxel = framebufTexA[this.thread.z][this.thread.y][this.thread.x];
      const fbBVoxel = framebufTexB[this.thread.z][this.thread.y][this.thread.x];
      return [clampValue(fbAVoxel[0]+fbBVoxel[0], 0.0, 1.0), clampValue(fbAVoxel[1]+fbBVoxel[1], 0.0, 1.0), clampValue(fbAVoxel[2]+fbBVoxel[2], 0.0, 1.0)];
    }, {...this.pipelineFuncSettings, name:'addFramebuffersFunc', argumentTypes: {framebufTexA: 'Array3D(3)', framebufTexB: 'Array3D(3)'}});

    this.copyFramebufferFunc = this.gpu.createKernel(function(framebufTex) {
      return framebufTex[this.thread.z][this.thread.y][this.thread.x];
    }, {...this.pipelineFuncSettings, name:'copyFramebufferFunc', argumentTypes: {framebufTex: 'Array3D(3)'}});
    
    this.copyFramebufferFuncImmutable = this.gpu.createKernel(function(framebufTex) {
      return framebufTex[this.thread.z][this.thread.y][this.thread.x];
    }, {...this.pipelineFuncSettings, name:'copyFramebufferFuncImmutable', immutable: true, argumentTypes: {framebufTex: 'Array3D(3)'}});
    
    this.combineFramebuffersAlphaOneMinusAlphaFunc = this.gpu.createKernel(function(fb1Tex, fb2Tex, alpha, oneMinusAlpha) {
      const fb1Voxel = fb1Tex[this.thread.z][this.thread.y][this.thread.x];
      const fb2Voxel = fb2Tex[this.thread.z][this.thread.y][this.thread.x];
      return [
        alpha*fb1Voxel[0] + oneMinusAlpha*fb2Voxel[0],
        alpha*fb1Voxel[1] + oneMinusAlpha*fb2Voxel[1],
        alpha*fb1Voxel[2] + oneMinusAlpha*fb2Voxel[2]
      ];
    }, {...this.pipelineFuncSettings, name:'combineFramebuffersAlphaOneMinusAlphaFunc', argumentTypes: {fb1Tex: 'Array3D(3)', fb2Tex: 'Array3D(3)', alpha: 'Float', oneMinusAlpha: 'Float'}});

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
    }, {...shapesDrawSettings, name: 'spheresFillOverwrite'});

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
    }, {...shapesDrawSettings, name: 'cubesFillOverwrite'});

    this.diamondsFillOverwrite = this.gpu.createKernel(function(framebufTex, c, radii, colours, brightness) {
      const currVoxelPos = [this.thread.z, this.thread.y, this.thread.x];
      const framebufColour = framebufTex[this.thread.z][this.thread.y][this.thread.x];
      const manhattanDist = Math.abs(currVoxelPos[0] - c[0]) + Math.abs(currVoxelPos[1] - c[1]) + Math.abs(currVoxelPos[2] - c[2]);

      for (let i = 0; i < this.constants.gridSize; i++) {
        // We're inside the diamond if the Manhattan distance of the point to the center is 
        // less than or equal to the current diamond's radius
        const radius = radii[i];
        if (manhattanDist <= radius) {
          const currColour = colours[i];
          return [brightness*currColour[0], brightness*currColour[1], brightness*currColour[2]];
        }
      }
      return [framebufColour[0], framebufColour[1], framebufColour[2]];
    }, {...shapesDrawSettings, name: 'diamondsFillOverwrite'});

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
    }, {...fireLookupSettings, name: 'fireLookupGen'});

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
      name: 'fireOverwrite',
      argumentTypes: { fireLookupTex: 'Array1D(4)', temperatureArr: 'Array', offsetXYZ: 'Array'},
      constants: {...this.pipelineFuncSettings.constants, FIRE_SPECTRUM_WIDTH: FIRE_SPECTRUM_WIDTH}
    });
  }

  initDistortionPPKernels(gridSize) {
    if (this._distortionPPKernelsInit) { return; }

    const distortionPPSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true,
      immutable: true,
      returnType: 'Array(3)',
      constants: {
        gridSize,
        gridSizeMinus1: gridSize-1,
      }
    };

    this.gpu.addFunction(function ramp(y, start, end) {
      const inside = (y < start ? 0.0 : 1.0) - (y < end ? 0.0 : 1.0);
      const fract = (y-start) / (end-start) * inside;
      return (1.0-fract) * inside;
    }, {name: 'ramp', returnType: "Float", argumentTypes: {y: "Float", start: "Float", end: "Float"}});

    this.gpu.addFunction(function noise(uvw, noiseMove, noiseAxisMask) {
      const noiseLookup = [
        uvw[0] + noiseMove*noiseAxisMask[0], 
        uvw[1] + noiseMove*noiseAxisMask[1], 
        uvw[2] + noiseMove*noiseAxisMask[2]
      ];
      let noise = whiteNoise3dTo1d(noiseLookup);
      noise *= noise;
      noise /= 2.0;
      return noise;
    }, {name: 'noise', returnType: "Float", argumentTypes: {uvw: "Array(3)", noiseMove: "Float", noiseAxisMask: "Array(3)"}});

    this.gpu.addFunction(function onOff(a, b, c, timeCounter) {
      return (Math.sin(timeCounter + a*Math.cos(timeCounter*b)) < c ? 0.0 : 1.0);
    }, {name: 'onOff', returnType: "Float", argumentTypes: {a: "Float", b: "Float", c: "Float", timeCounter: "Float"}});

    this.gpu.addFunction(function videoShiftLookup(uvw, timeCounter, distortHorizontal, distortVertical) {
      const adjTimeCounter = timeCounter / 4.0;
      const window = 1.0 / (1.0 + 20 * (uvw[1] - (adjTimeCounter % 1.0) * (uvw[1] - (adjTimeCounter % 1.0))));
      const hShift = distortHorizontal * (Math.sin(uvw[1]*10.0 + timeCounter)/15.0 * onOff(4.0, 4.0, 0.3, timeCounter) * 
        (1.0 + Math.cos(timeCounter*80.0)) * window);
      const vShift = distortVertical * (0.4 * onOff(2.0, 3.0, 0.9, timeCounter) * (Math.sin(timeCounter) * Math.sin(timeCounter*20.0) + 
        0.5 + 0.1*Math.sin(timeCounter*200.0)*Math.cos(timeCounter)));

      return [
        (uvw[0] + hShift + 1.0) % 1.0,
        (uvw[1] + vShift + 1.0) % 1.0,
        (uvw[2] + hShift + 1.0) % 1.0,
      ];
    }, {name: "videoShiftLookup", returnType:"Array(3)", 
      argumentTypes: {uvw: "Array(3)", timeCounter: "Float", distortHorizontal: "Float", distortVertical: "Float"
    }});

    this.gpu.addFunction(function stripes(uvw, noiseMove, noiseAxisMask, timeCounter, noiseSpeed) {
      const augUVW = [uvw[0]*0.5 + 1.0, uvw[1] + 3.0, uvw[2]*0.5 + 1.0];
      
      const noiseLookup = [
        augUVW[0] + noiseMove*noiseAxisMask[0]*0.0001, 
        augUVW[1] + noiseMove*noiseAxisMask[1]*0.0001, 
        augUVW[2] + noiseMove*noiseAxisMask[2]*0.0001
      ];
      let noise = whiteNoise3dTo1d(noiseLookup);
      noise *= noise;

      const adjTimeCounter = timeCounter*noiseSpeed;
      const val = uvw[1]*2.0 + adjTimeCounter/2.0 + Math.sin(adjTimeCounter + Math.sin(adjTimeCounter*0.63));
      return ramp(val % 1.0, 0.4, 0.65) * noise;

    }, {name: 'stripes', returnType: "Float", 
      argumentTypes: {uvw: "Array(3)", noiseMove: "Float", noiseAxisMask: "Array(3)", timeCounter: "Float", noiseSpeed: "Float"
    }});

    this.distortionFunc = this.gpu.createKernel(function(
      fbTex, timeCounter, noiseAlpha, noiseAxisMask, noiseSpeed, distortHorizontal, distortVertical
    ) {
      const x = this.thread.z; const y = this.thread.y; const z = this.thread.x;

      const noiseMove = 2.0*Math.cos(timeCounter)*timeCounter*8.0;
      const uvw = [x/this.constants.gridSize, y/this.constants.gridSize, z/this.constants.gridSize];
      const noise = noise(uvw, noiseMove*noiseSpeed*0.000001, noiseAxisMask);
      const stripes = stripes(uvw, noiseMove, noiseAxisMask, timeCounter, noiseSpeed);
      const noiseAmt = (noise + stripes)*noiseAlpha;

      const nLookup = videoShiftLookup(uvw, timeCounter, distortHorizontal, distortVertical);
      const lookup = [
        Math.floor(nLookup[0]*this.constants.gridSize),
        Math.floor(nLookup[1]*this.constants.gridSize),
        Math.floor(nLookup[2]*this.constants.gridSize),
      ];
      const shiftedVoxel = fbTex[lookup[0]][lookup[1]][lookup[2]];
      return [
        Math.min(1.0, shiftedVoxel[0]+noiseAmt),
        Math.min(1.0, shiftedVoxel[1]+noiseAmt),
        Math.min(1.0, shiftedVoxel[2]+noiseAmt)
      ];
    }, {...distortionPPSettings, name: "distortionFunc", 
      argumentTypes: {fbTex: "Array3D(3)", timeCounter: "Float", noiseAlpha: "Float", noiseAxisMask: "Array(3)", noiseSpeed: "Float",
                      distortHorizontal: "Float", distortVertical: "Float"
      }
    });

    this._distortionPPKernelsInit = true;
  }

  initTVTurnOffPPKernels(gridSize) {
    if (this._tvTurnOffPPKernelsInit) { return; }

    const tvTurnOffPPSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true,
      immutable: true,
      returnType: 'Array(3)',
      constants: {
        gridSize,
        gridSizeMinus1: gridSize-1,
      }
    };

    this.tvTurnOffFunc = this.gpu.createKernel(function(fbTex, offAmount) {
      const x = this.thread.z; const y = this.thread.y; const z = this.thread.x;
      if (offAmount <= 0) { return [0,0,0] }
      const uvw = [x/this.constants.gridSizeMinus1, y/this.constants.gridSizeMinus1, z/this.constants.gridSizeMinus1];
      const vignetteAmt = (uvw[0]-0.5)*(uvw[0]-0.5)*(uvw[1]-0.5)*(uvw[1]-0.5)*(uvw[2]-0.5)*(uvw[2]-0.5) * Math.pow(10000000.0, offAmount);
      const vignetteCoeff = clampValue(1.0 - Math.pow(vignetteAmt, 0.8), 0.0, 1.0);
      const voxel = fbTex[x][y][z];
      return [voxel[0]*vignetteCoeff, voxel[1]*vignetteCoeff, voxel[2]*vignetteCoeff];
    }, {...tvTurnOffPPSettings, name: "tvTurnOffFunc", argumentTypes: {fbTex: "Array3D(3)", offAmount: "Float"}
    });

    this._tvTurnOffPPKernelsInit = true;
  }

  initChromaticAberrationPPKernels(gridSize) {
    if (this._chromaticAbPPKernelsInit) { return; }

    const chromaticAberrationPPSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true,
      immutable: true,
      returnType: 'Array(3)',
      constants: {
        gridSizeMinus1: gridSize-1,
      }
    };

    this.chromaticAberrationFunc = this.gpu.createKernel(function(fbTex, intensity, alpha, xyzMask) {
      const x = this.thread.z; const y = this.thread.y; const z = this.thread.x;

      const rX = clampValue(Math.floor(x + intensity*xyzMask[0]), 0, this.constants.gridSizeMinus1);
      const rY = clampValue(Math.floor(y + intensity*xyzMask[1]), 0, this.constants.gridSizeMinus1);
      const rZ = clampValue(Math.floor(z + intensity*xyzMask[2]), 0, this.constants.gridSizeMinus1);

      const bX = clampValue(Math.floor(x - intensity*xyzMask[0]), 0, this.constants.gridSizeMinus1);
      const bY = clampValue(Math.floor(y - intensity*xyzMask[1]), 0, this.constants.gridSizeMinus1);
      const bZ = clampValue(Math.floor(z - intensity*xyzMask[2]), 0, this.constants.gridSizeMinus1);

      const voxel = fbTex[x][y][z];
      const rCh = fbTex[rX][rY][rZ];
      const gCh = fbTex[x][y][z];
      const bCh = fbTex[bX][bY][bZ];

      const oneMinusAlpha = 1.0 - alpha;
      return [
        oneMinusAlpha*voxel[0] + alpha*rCh[0], 
        oneMinusAlpha*voxel[1] + alpha*gCh[1], 
        oneMinusAlpha*voxel[2] + alpha*bCh[2]
      ];

    }, {...chromaticAberrationPPSettings, name: "chromaticAberrationFunc", 
      argumentTypes: {fbTex: "Array3D(3)", intensity: "Float", alpha: "Float", xyzMask: "Array(3)"
    }});

    this._chromaticAbPPKernelsInit = true;
  }

  initGaussianBlurPPKernels(gridSize, kernelSize) {
    if (this._gaussianBlurPPKernelsInit) { return; }

    const gaussianBlurPPSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true,
      constants: {
        gridSize: gridSize,
        gridSizeMinus1: gridSize-1,
        kernelSize: kernelSize,
        kernelOffsetExtent: Math.floor((kernelSize-1)/2),
        TWOPI: 2*Math.PI,
      },
      immutable: true,
      returnType: 'Array(3)',
    };

    this.gpu.addFunction(function gaussian(offset, sqrSigma) {
      return (1.0 / Math.sqrt(this.constants.TWOPI*sqrSigma)) * Math.pow(2.71828, -((1.0*offset*offset)/(2.0*sqrSigma)));
    },  {name: 'gaussian', argumentTypes: {offset: "Float", sqrSigma: "Float"}});

    const gaussBlurArgTypes = {fbTex: "Array3D(3)", sqrSigma: "Float", conserveEnergy: "Boolean", alpha: "Float"};
    this.gpu.addFunction(function gaussianBlur(fbTex, sqrSigma, isXYZ, conserveEnergy, alpha) {
      const x = this.thread.z; const y = this.thread.y; const z = this.thread.x;
      if (sqrSigma === 0 || alpha === 0) { return fbTex[x][y][z]; } // Safe out if there's no blur

      // NOTE: Be VERY careful about integer vs. floating point math, be sure to add decimals to any numbers
      // where you want a float result!! Any for loop counter will be an integer.
      const result = [0.0, 0.0, 0.0];
      let sum = 0.0;
      for (let offset = -this.constants.kernelOffsetExtent; offset <= this.constants.kernelOffsetExtent; offset++) {
        const currAlpha = (offset === 0) ? 1.0 : alpha;
        const gaussCoeff = gaussian(offset, sqrSigma); // Gaussian Distribution
        sum += gaussCoeff;
        const offsetLookup = [
          Math.trunc(clampValue(x + offset*isXYZ[0], 0, this.constants.gridSizeMinus1)), 
          Math.trunc(clampValue(y + offset*isXYZ[1], 0, this.constants.gridSizeMinus1)),
          Math.trunc(clampValue(z + offset*isXYZ[2], 0, this.constants.gridSizeMinus1))
        ];
        const currSample = fbTex[offsetLookup[0]][offsetLookup[1]][offsetLookup[2]];
        result[0] += currSample[0] * gaussCoeff * currAlpha;
        result[1] += currSample[1] * gaussCoeff * currAlpha;
        result[2] += currSample[2] * gaussCoeff * currAlpha;
      }
      const gaussian0 = gaussian(0, sqrSigma);
      return conserveEnergy ? [result[0]/sum, result[1]/sum, result[2]/sum] :
       [
        clampValue(result[0]/gaussian0, 0.0, 1.0), 
        clampValue(result[1]/gaussian0, 0.0, 1.0), 
        clampValue(result[2]/gaussian0, 0.0, 1.0)
      ];
    }, {name: 'gassianBlur'});

    this.blurXFunc = this.gpu.createKernel(function(fbTex, sqrSigma, conserveEnergy, alpha) {
      //return [0,1,0];
      return gaussianBlur(fbTex, sqrSigma, [1.0, 0.0, 0.0], conserveEnergy, alpha);
    }, {...gaussianBlurPPSettings, name: "blurXFunc", argumentTypes: gaussBlurArgTypes});
    this.blurYFunc = this.gpu.createKernel(function(fbTex, sqrSigma, conserveEnergy, alpha) {
      //return [0,1,0];
      return gaussianBlur(fbTex, sqrSigma, [0.0, 1.0, 0.0], conserveEnergy, alpha);
    }, {...gaussianBlurPPSettings, name: "blurYFunc", argumentTypes: gaussBlurArgTypes});
    this.blurZFunc = this.gpu.createKernel(function(fbTex, sqrSigma, conserveEnergy, alpha) {
      //return [0,1,0];
      return gaussianBlur(fbTex, sqrSigma, [0.0, 0.0, 1.0], conserveEnergy, alpha);
    }, {...gaussianBlurPPSettings, name: "blurZFunc", argumentTypes: gaussBlurArgTypes});

    this._gaussianBlurPPKernelsInit = true;
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
    }, {name: 'xyzLookup'});
    this.gpu.addFunction(function clampm1(c) {
      return Math.max(c-1, 0);
    }, {name: 'clampm1'});
    this.gpu.addFunction(function clampm2(c) {
      return Math.max(c-2, 0);
    }, {name: 'clampm2'});
    this.gpu.addFunction(function clampmX(c,x) {
      return Math.max(c-x, 0);
    }, {name: 'clampmX'});
    this.gpu.addFunction(function clampp1(c) {
      return Math.min(c+1, this.constants.NPLUS1);
    }, {name: 'clampp1'});
    this.gpu.addFunction(function clampp2(c) {
      return Math.min(c+2, this.constants.NPLUS1);
    }, {name: 'clampp2'});
    this.gpu.addFunction(function clamppX(c,x) {
      return Math.min(c+x, this.constants.NPLUS1);
    }, {name: 'clamppX'});
    
    this.gpu.addFunction(function length3(vec) {
      return Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1] + vec[2]*vec[2]);
    }, {name: 'length3'});
    this.gpu.addFunction(function normalize3(vec) {
      const len = length3(vec) + 0.0001;
      return [vec[0]/len, vec[1]/len, vec[2]/len];
    }, {name: 'normalize3'});
    this.gpu.addFunction(function lerp(x, x0, x1, y0, y1) {
      return y0 + (x-x0) * ((y1-y0) / (x1 - x0 + 0.00001));
    }, {name: 'lerp'});

    this.initFluidBufferFunc = this.gpu.createKernel(function(value) {
      return value;
    }, {...pipelineFuncSettings, name: 'initFluidBufferFunc', argumentTypes: {value: 'Float'}});
    this.initFluidBuffer3Func = this.gpu.createKernel(function(x,y,z) {
      return [x, y, z];
    }, {...pipelineFuncSettings, name: 'initFluidBuffer3Func', returnType: 'Array(3)', argumentTypes: {x: 'Float', y: 'Float', z: 'Float'}});
    
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
    }, {name: 'ijkLookup'});

    const ARRAY3D_TYPE = 'Array';
    const ARRAY3D_3_TYPE = 'Array3D(3)';
    
    this.addFluidSourceFunc = this.gpu.createKernel(function(srcBuffer, dstBuffer, dt) {
      const [i,j,k] = ijkLookup();
      return dstBuffer[i][j][k] + srcBuffer[i][j][k] * dt;
    }, {...pipelineFuncSettings, name: 'addFluidSourceFunc', returnType: 'Float', argumentTypes: {srcBuffer: ARRAY3D_TYPE, dstBuffer: ARRAY3D_TYPE, dt: 'Float'}});

    this.addBuoyancyFunc = this.gpu.createKernel(function(T, uvw, dtBuoy) {
      const [i,j,k] = ijkLookup();
      const uvwVec = uvw[i][j][k];
      return [uvwVec[0], uvwVec[1]  + T[i][j][k] * dtBuoy, uvwVec[2]];
    }, {...pipelineFuncSettings, name: 'addBuoyancyFunc', returnType: 'Array(3)', argumentTypes: {T: ARRAY3D_TYPE, uvw: ARRAY3D_3_TYPE, dtBuoy: 'Float'}});

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
    }, {...pipelineFuncSettings, name: 'diffuseStepFunc', returnType: 'Float', 
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
    }, {...pipelineFuncSettings, name: 'diffuseStep3Func', returnType: 'Array(3)', 
      argumentTypes: {uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE, a: 'Float', boundaryBuf: ARRAY3D_TYPE}
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
    }, {...pipelineFuncSettings, name: 'advectCoolFunc', returnType: 'Float', 
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
    }, {...pipelineFuncSettings, name: 'advect3Func', returnType: 'Array(3)', 
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
    }, {...pipelineFuncSettings, name: 'projectStep1Func', returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE}});

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
    }, {...pipelineFuncSettings, name: 'projectStep2Func', returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE}});

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
    }, {...pipelineFuncSettings, name: 'projectStep3Func', returnType: 'Array(3)', 
      argumentTypes: {uvw: ARRAY3D_3_TYPE, uvw0: ARRAY3D_3_TYPE, boundaryBuf: ARRAY3D_TYPE}
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
    },  {...pipelineFuncSettings, name: 'curlFunc', returnType: 'Array(3)', argumentTypes: {curlxyz: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE}});

    this.vorticityConfinementStep1Func = this.gpu.createKernel(function(curlxyz) {
      const [i,j,k] = ijkLookup();
      const curlxyzijk = curlxyz[i][j][k];
      const x = curlxyzijk[0];
      const y = curlxyzijk[1];
      const z = curlxyzijk[2];
      return Math.sqrt(x*x + y*y + z*z);
    }, {...pipelineFuncSettings, name: 'vorticityConfinementStep1Func', returnType: 'Float', argumentTypes: {curlxyz: ARRAY3D_3_TYPE}});
  
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
    }, {...pipelineFuncSettings, name: 'vorticityConfinementStep2Func', returnType: 'Array(3)', 
      argumentTypes: {uvw: ARRAY3D_3_TYPE, T0: ARRAY3D_TYPE, curlxyz: ARRAY3D_3_TYPE, dt0: 'Float'}
    });

    this._fireKernelsInit = true;
  }

  initDisplayFramebufferSliceKernels(gridSize) {
    if (this._displayFBSliceKernelsInit) { return; }

    const commonSettings = {
      output: [gridSize, gridSize, gridSize], 
      pipeline: true,
      returnType: 'Array(3)',
      constants: {
        gridSize,
        gridSizeMinus1: gridSize-1,
      },
    };

    this.initRGBFBBuffer4Func = this.gpu.createKernel(function(valueX, valueY, valueZ) {
      return [valueX, valueY, valueZ];
    }, {...commonSettings, immutable: true, name: 'initRGBFBBuffer4Func', argumentTypes: {
      valueX: 'Float', valueY: 'Float', valueZ: 'Float',
    }});

    this.gpu.addFunction(function flatRGBBufferToRGB(xyz, width, height, rgbaFlatBuffer) {
      const widthScale = width/this.constants.gridSize;
      const heightScale = height/this.constants.gridSize;

      // Incoming rgba has its origin at the top-left
      const stride = Math.floor(4.0*(heightScale*this.constants.gridSize*xyz[1] + widthScale*xyz[0]));
      // Ignore the incoming alpha and just output the rgb, each channel in [0,1]
      return [
        rgbaFlatBuffer[stride]   / 255.0,
        rgbaFlatBuffer[stride+1] / 255.0,
        rgbaFlatBuffer[stride+2] / 255.0,
        //rgbaFlatBuffer[stride+3] / 255.0
      ];
    }, {name: 'flatRGBBufferToRGB'});

    this.singleSliceRGBAIntoFBKernel = this.gpu.createKernel(function(width, height, rgbaFlatBuffer) {
      const xyz = [this.thread.z, this.thread.y, this.thread.x];
      if (xyz[2] !== this.constants.gridSizeMinus1) { return [0,0,0]; }
      return flatRGBBufferToRGB(xyz, width, height, rgbaFlatBuffer);
    }, {...commonSettings, immutable: false, name: 'singleSliceRGBAIntoFBKernel', argumentTypes: {
        width: 'Float', height: 'Float', rgbaFlatBuffer: 'Array',
      },
    });

    this.insertRGBAIntoFBKernel = this.gpu.createKernel(function(prevFBTex, width, height, rgbaFlatBuffer) {
      const xyz = [this.thread.z, this.thread.y, this.thread.x];

      // Shift all the pixels along the z-axis, unless we're in the insertion index
      if (xyz[2] !== this.constants.gridSizeMinus1) {
        const zSrcIdx = xyz[2] + 1;
        return prevFBTex[xyz[0]][xyz[1]][zSrcIdx];
      }

      // We're in the insertion index, insert the new rgba buffer slice
      return flatRGBBufferToRGB(xyz, width, height, rgbaFlatBuffer);

    }, {...commonSettings, immutable: true, name: 'insertRGBAIntoFBKernel', argumentTypes: {
        prevFBTex: 'Array3D(3)', width: 'Float', height: 'Float', rgbaFlatBuffer: 'Array',
      },
    });

    this._displayFBSliceKernelsInit = true;
  }

  initBlockVisualizerKernels(gridSize, numColours) {
    if (this._blockVisKernelsInit) { return; }

    const blockVisFuncSettings = {
      output: [gridSize, gridSize, gridSize],
      pipeline: true,
      immutable: true,
      returnType: 'Array(4)',
      constants: {
        gridSize,
        gridSizeMinus1: gridSize-1.0,
        numColoursMinus1: numColours-1.0,
      }
    };

    this.initBlockVisualizerBuffer4Func = this.gpu.createKernel(function(valueX, valueY, valueZ, valueW) {
      return [valueX, valueY, valueZ, 0];
    }, {...blockVisFuncSettings, name: 'initBlockVisualizerBuffer4Func', argumentTypes: {
      valueX: 'Float', valueY: 'Float', valueZ: 'Float', valueW: 'Float'
    }});

    this.blockVisFunc = this.gpu.createKernel(function(audioLevels, shuffleLookup, prevVisTex, colours, blockSize, levelMax, fadeFactor, dt) {
      
      const xyz = [this.thread.z, this.thread.y, this.thread.x];
      const numBlocksPerSide = Math.floor(this.constants.gridSize / blockSize);
      const numBlocks = numBlocksPerSide*numBlocksPerSide*numBlocksPerSide;
      const blockIdx = [Math.floor(xyz[0] / blockSize), Math.floor(xyz[1] / blockSize), Math.floor(xyz[2] / blockSize)];
      const levelIdx = Math.min(shuffleLookup[
        Math.min(blockIdx[0]*numBlocksPerSide*numBlocksPerSide + blockIdx[1]*numBlocksPerSide + blockIdx[2], numBlocks-1)
      ], numBlocks-1);

      const audioLvlNorm = Math.log10(audioLevels[levelIdx]) / levelMax;
      const audioLvlPct  = clampValue(audioLvlNorm, 0.0, 1.0);
      let colourIdxDecimal = audioLvlPct * this.constants.numColoursMinus1;
      const colourIdxLow  = Math.floor(colourIdxDecimal);
      const colourIdxHigh = Math.min(Math.ceil(colourIdxDecimal), this.constants.numColoursMinus1);
      colourIdxDecimal -= colourIdxLow;

      const currColourLow  = colours[colourIdxLow];
      const currColourHigh = colours[colourIdxHigh];
      const currColour = [
        (1.0 - colourIdxDecimal) * currColourLow[0] + colourIdxDecimal * currColourHigh[0],
        (1.0 - colourIdxDecimal) * currColourLow[1] + colourIdxDecimal * currColourHigh[1],
        (1.0 - colourIdxDecimal) * currColourLow[2] + colourIdxDecimal * currColourHigh[2],
      ]; // Lerp between the high and low colours

      const fadeFactorAdjusted = clampValue(Math.pow(fadeFactor, dt), 0.0, 1.0);
      const prevVoxel = prevVisTex[xyz[0]][xyz[1]][xyz[2]];
      const alpha = (prevVoxel[3] * fadeFactorAdjusted) + audioLvlPct * (1.0-fadeFactorAdjusted);

      return [
        clampValue(currColour[0] + blockIdx[0]/numBlocksPerSide, 0.0, 1.0),
        clampValue(currColour[1] + blockIdx[1]/numBlocksPerSide, 0.0, 1.0),
        clampValue(currColour[2] + blockIdx[2]/numBlocksPerSide, 0.0, 1.0), alpha
      ];
    }, {...blockVisFuncSettings, name: 'blockVisFunc', argumentTypes: {
      audioLevels: 'Array', shuffleLookup: 'Array', prevVisTex: 'Array3D(4)', colours: 'Array1D(3)', 
      blockSize: 'Float', levelMax: 'Float', fadeFactor: 'Float', dt: 'Float'
    }});

    this.renderBlockVisualizerAlphaFunc = this.gpu.createKernel(function(blockrVisTex) {
      const currVoxel = blockrVisTex[this.thread.z][this.thread.y][this.thread.x];
      return [
        clampValue(currVoxel[0]*currVoxel[3], 0.0, 1.0), 
        clampValue(currVoxel[1]*currVoxel[3], 0.0, 1.0), 
        clampValue(currVoxel[2]*currVoxel[3], 0.0, 1.0)
      ];
    }, {...blockVisFuncSettings, name: 'renderBlockVisualizerAlphaFunc', immutable: false, returnType: 'Array(3)', argumentTypes: {blockrVisTex: 'Array3D(4)'}});

    this._blockVisKernelsInit = true;
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

    this.initBarVisualizerBuffer4Func = this.gpu.createKernel(function(valueX, valueY, valueZ, valueW) {
      return [valueX, valueY, valueZ, valueW];
    }, {...barVisFuncSettings, name: 'initBarVisualizerBuffer4Func', immutable: true, argumentTypes: {
      valueX: 'Float', valueY: 'Float', valueZ: 'Float', valueW: 'Float'
    }});

    this.gpu.addFunction(function calcAudioCutoff(audioIntensity, levelMax, height) {
      return (Math.log10(audioIntensity) / levelMax) * height;
    }, {name: 'calcAudioCutoff'});
    this.gpu.addFunction(function barVisCutoff(audioLevels, levelMax, height) {
      const levelIdx  = this.constants.sqrtNumAudioLevels*Math.floor(this.thread.z/this.constants.chunkSize) +  Math.floor(this.thread.x/this.constants.chunkSize);
      return calcAudioCutoff(audioLevels[levelIdx], levelMax, height);
    }, {name: 'barVisCutoff'});
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
    }, {name: 'barVisCutoffCentered'});

    this.gpu.addFunction(function drawBarVis(prevVisTex, levelColours, cutoff, cutoffClampSize, fadeFactor, dt, yIdx, glowMultiplier) {
      const prevVoxelRGBA = prevVisTex[this.thread.z][this.thread.y][this.thread.x];
      const fadeFactorAdjusted = clampValue(Math.pow(fadeFactor, dt), 0.0, 1.0);
      const clampedCutoff = clampValue(cutoff, 0, cutoffClampSize);
      const isVisible = yIdx < clampedCutoff ? 1.0 : 0.0;

      // Allow bars to fade over time, make especially high intensity bars glow white
      const alpha = (prevVoxelRGBA[3] * fadeFactorAdjusted + isVisible * (prevVoxelRGBA[3]*glowMultiplier*Math.max(cutoff-cutoffClampSize, 0.0) + 1.0 - fadeFactorAdjusted));
      return [
        levelColours[yIdx][0],
        levelColours[yIdx][1],
        levelColours[yIdx][2], clampValue(alpha, 0.0, 1.0)
      ];
    }, {name: 'drawBarVis'});

    const barVisArgs = {audioLevels: 'Array', levelMax: 'Float', fadeFactor: 'Float', levelColours: 'Array', prevVisTex: 'Array3D(4)', dt: 'Float'};

    this.staticBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoff(audioLevels, levelMax, this.constants.gridSize);
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.gridSize, fadeFactor, dt, this.thread.y, 0.02);
    }, {...barVisFuncSettings, name: 'staticBarVisFunc', immutable: true, argumentTypes: barVisArgs});

    this.staticSplitLevelBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoff(audioLevels, levelMax, this.constants.halfGridSize);
      const yIndex = Math.floor(Math.abs(this.thread.y + 1 - this.constants.halfGridSize));
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.halfGridSize, fadeFactor, dt, yIndex, 0.02);
    }, {...barVisFuncSettings, name: 'staticSplitLevelBarVisFunc', immutable: true, argumentTypes: barVisArgs});

    this.staticCenteredBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoffCentered(audioLevels, levelMax, this.constants.gridSize);
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.gridSize, fadeFactor, dt, this.thread.y, 0.01);
    }, {...barVisFuncSettings, name: 'staticCenteredBarVisFunc', immutable: true, argumentTypes: barVisArgs});

    this.staticCenteredSplitLevelBarVisFunc = this.gpu.createKernel(function(audioLevels, levelMax, fadeFactor, levelColours, prevVisTex, dt) {
      const cutoff = barVisCutoffCentered(audioLevels, levelMax, this.constants.halfGridSize);
      const yIndex = Math.floor(Math.abs(this.thread.y + 1 - this.constants.halfGridSize));
      return drawBarVis(prevVisTex, levelColours, cutoff, this.constants.halfGridSize, fadeFactor, dt, yIndex, 0.01);
    }, {...barVisFuncSettings, name: 'staticCenteredSplitLevelBarVisFunc', immutable: true, argumentTypes: barVisArgs});


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
    }, {...barVisFuncSettings, name: 'historyBarVisFunc', immutable: true, argumentTypes: historyBarVisArgs});

    this.renderBarVisualizerAlphaFunc = this.gpu.createKernel(function(barVisTex) {
      const currVoxel = barVisTex[this.thread.z][this.thread.y][this.thread.x];
      return [
        clampValue(currVoxel[0]*currVoxel[3], 0.0, 1.0), 
        clampValue(currVoxel[1]*currVoxel[3], 0.0, 1.0), 
        clampValue(currVoxel[2]*currVoxel[3], 0.0, 1.0)
      ];
    }, {...barVisFuncSettings, name: 'renderBarVisualizerAlphaFunc', returnType: 'Array(3)', argumentTypes: {barVisTex: 'Array3D(4)'}});

    this._barVisKernelsInit = true;
  }
}

export default GPUKernelManager;
