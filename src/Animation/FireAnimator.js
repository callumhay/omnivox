import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import AudioVisualizerAnimator, {RandomHighLowColourCycler} from './AudioVisualizerAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';
import {Randomizer} from '../Randomizers';

import FireGPU from '../FireGPU';
import Spectrum, {ColourSystems, FIRE_SPECTRUM_WIDTH, COLOUR_INTERPOLATION_RGB} from '../Spectrum';
import {PI2, clamp} from '../MathUtils';

const REINIT_FLUID_TIME_SECS = 0.1;
const MAX_AVG_BEATS_PER_SEC = 120;

// Fire colour types
const LOW_HIGH_TEMP_COLOUR_MODE = "Low High Temp";
const TEMPERATURE_COLOUR_MODE   = "Temperature";
const RANDOM_COLOUR_MODE        = "Random";

export const fireAnimatorDefaultConfig = {
  speed: 2.0,
  buoyancy: 1.2,
  cooling: 0.5,
  initialIntensityMultiplier: 8,
  vorticityConfinement: 8.0,

  colourMode: TEMPERATURE_COLOUR_MODE,
  colourInterpolationType: COLOUR_INTERPOLATION_RGB,

  // Temperature Colour Mode
  spectrumTempMin: 500,
  spectrumTempMax: 1700,
  colourSystem: 'CIEsystem',
  // Low-High Colour Mode
  lowTempColour:  {r: 0.2, g: 0, b: 1},
  highTempColour: {r: 1, g: 0, b: 0.7},
  // Random Colour Mode
  ...RandomHighLowColourCycler.randomColourCyclerDefaultConfig,

  ...soundVisDefaultConfig,
  levelMax: 1.25,
  audioVisualizationOn: false,
  audioSpeedMultiplier: 0.1,
  audioCoolingMultiplier: 0.1,
  audioBuoyancyMultiplier: 1,
  audioTurbulenceMultiplier: 1,
  audioNoiseAddition: 0.2,

  wallPosX: -1,
  wallNegX: -1,
  wallPosY: -1,
  wallPosZ: -1,
  wallNegZ: -1,
};

class FireAnimator extends AudioVisualizerAnimator {
  static get LOW_HIGH_TEMP_COLOUR_MODE() { return LOW_HIGH_TEMP_COLOUR_MODE; }
  static get TEMPERATURE_COLOUR_MODE() { return TEMPERATURE_COLOUR_MODE; }
  static get RANDOM_COLOUR_MODE() { return RANDOM_COLOUR_MODE; }
  static get COLOUR_MODES() {
    return [
      LOW_HIGH_TEMP_COLOUR_MODE,
      TEMPERATURE_COLOUR_MODE,
      RANDOM_COLOUR_MODE,
    ];
  }

  constructor(voxelModel, config=fireAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_FIRE; }

  setConfig(c) {
    super.setConfig(c);

    const {randomColourHoldTime, randomColourTransitionTime} = c;
    if (!this.randomColourCycler) {
      this.randomColourCycler = new RandomHighLowColourCycler();
    }
    this.randomColourCycler.setConfig({randomColourHoldTime, randomColourTransitionTime});

    const {
      audioVisualizationOn, audioNoiseAddition, buoyancy, cooling, vorticityConfinement,
      wallPosX, wallNegX, wallPosY, wallNegY, wallPosZ, wallNegZ,
    } = c;
    const INTENSITY_ARRAY_SIZE = Math.min(128, Math.pow(this.voxelModel.gridSize,2));
    this.audioIntensitiesArray = new Array(INTENSITY_ARRAY_SIZE).fill(0);
    this.randomArray = Randomizer.getRandomFloats(INTENSITY_ARRAY_SIZE, 0, audioVisualizationOn ? audioNoiseAddition : 1);

    if (!this.fluidModel) {
      this.fluidModel = new FireGPU(this.voxelModel.gridSize, this.voxelModel.gpuKernelMgr);
    }
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = buoyancy;
    this.fluidModel.cooling   = cooling;
    this.fluidModel.vc_eps    = vorticityConfinement;
    this.fluidModel.setBoundary({
      posXOffset:wallPosX, negXOffset:wallNegX, 
      posYOffset:wallPosY, negYOffset:-1,
      posZOffset:wallPosZ, negZOffset:wallNegZ
    });

    const {startX, endX, startY, startZ, endZ} = this._getFluidModelOffsets();
    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        this.fluidModel.sd[x][startY][z] = 1.0;
      }
    }
    
    this.genFireColourLookup();
  }

  reset() {
    super.reset();

    this.randomColourCycler.reset();
    
    this.t = 0;
    this.timeCounterToReinitFluid = Infinity;
    this.randIdx = 0;

    this.avgSpectralCentroid = 0;
    this.avgNormalizedSpectralCentroid = 0;
    this.avgAudioIntensity = 0;
  }

  _getFluidModelOffsets() {
    const startX = 1;
    const endX = this.voxelModel.xSize()+startX;
    const startZ = 1;
    const endZ = this.voxelModel.zSize()+startZ;
    const startY = 1;

    return {startX, endX, startY, startZ, endZ};
  }

  render(dt) {
    const {speed, initialIntensityMultiplier, audioVisualizationOn, audioSpeedMultiplier, colourMode} = this.config;

    // Offsets are used because the fluid model has two extra values on either side of each buffer in all dimensions in order
    // to properly calculate the derivatives within the grid. We need to get the values inside that margin and place them
    // into our voxel grid.
    const {startX, endX, startY, startZ, endZ} = this._getFluidModelOffsets();
    if (this.timeCounterToReinitFluid >= REINIT_FLUID_TIME_SECS) {
      const genFunc = audioVisualizationOn ? this._genAudioTemperatureFunc.bind(this) : this._genRandomTemperatureFunc.bind(this);
      for (let z = startZ; z < endZ; z++) {
        for (let x = startX; x < endX; x++) {
          let f = genFunc(x-startX, z-startZ, endX-startX, endZ-startZ, this.t);
          this.fluidModel.sT[x][startY][z] = 1.0 + f*initialIntensityMultiplier;
        }
      }
      this.timeCounterToReinitFluid = 0;
    }
    else {
      this.timeCounterToReinitFluid += dt;
    }

    const clampDt = clamp(dt, 0.0, 1.0/30.0); // Make sure our timesteps aren't too big or it will cause instability in the fire simulation
    const currSpeed = audioVisualizationOn ? speed + audioSpeedMultiplier*(1 + THREE.MathUtils.lerp(0, 0.5, this.avgBeatsPerSec/MAX_AVG_BEATS_PER_SEC)) : speed;
    const dtSpeed = clampDt*currSpeed;
    this.fluidModel.step(dtSpeed);
    this.t += dtSpeed;

    // In random colour mode we're animating the colour over time, check to see if it has changed and update it accordingly
    if (colourMode === RANDOM_COLOUR_MODE) {
      const {colourInterpolationType} = this.config;
      const currColours = this.randomColourCycler.tick(clampDt, colourInterpolationType);
      if (this.randomColourCycler.isTransitioning()) {
        this.fireLookup = FireAnimator._adjustSpectrumAlpha(Spectrum.genLowToHighColourSpectrum(currColours.lowTempColour, currColours.highTempColour, colourInterpolationType));
      }
    }

    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    gpuFramebuffer.drawFire(this.fireLookup, this.fluidModel.T, [startX, startY, startZ]);
  }

  setAudioInfo(audioInfo) {
    if (!this.config.audioVisualizationOn) {
      return;
    }
    //console.log("AUDIO!");
    super.setAudioInfo(audioInfo);

    const {gamma, levelMax, audioBuoyancyMultiplier, audioCoolingMultiplier, audioTurbulenceMultiplier, buoyancy, cooling, vorticityConfinement} = this.config;
    const {fft, spectralCentroid} = audioInfo;

    // Use the FFT array to populate the initialization array for the fire
    let numFreqs = Math.floor(fft.length/(gamma+1.8));

    // Build a distribution of what bins (i.e., meshes) to throw each frequency in
    if (!this.binIndexLookup || numFreqs !== this.binIndexLookup.length) {
      this.binIndexLookup = AudioVisualizerAnimator.buildBinIndexLookup(numFreqs, this.audioIntensitiesArray.length, gamma);
    }

    for (let i = 0; i < this.audioIntensitiesArray.length; i++) {
      const fftIndices = this.binIndexLookup[i];
      const binLevel = AudioVisualizerAnimator.calcFFTBinLevelMax(fftIndices, fft);
      this.audioIntensitiesArray[i] = clamp(Math.log10(binLevel)/levelMax, 0, 1);
    }

    // Update the fluid model levers based on the current audio
    this.avgSpectralCentroid = (this.avgSpectralCentroid + spectralCentroid) / 2.0;
    this.avgNormalizedSpectralCentroid = clamp(this.avgSpectralCentroid / (fft.length / 2), 0, 1);
    const buoyancyVal = buoyancy + clamp(this.avgNormalizedSpectralCentroid * 10, 0, 3);

    this.fluidModel.buoyancy = buoyancyVal * audioBuoyancyMultiplier;
    this.fluidModel.cooling  = cooling + clamp((1.0 - this.avgRMS) * audioCoolingMultiplier, 0, 2); // Values range from [0.1, 2] where lower values make the fire brighter/bigger
    this.fluidModel.vc_eps   = vorticityConfinement + (this.avgRMS * 30 * audioTurbulenceMultiplier);

    this.avgAudioIntensity = 0;
    for (let j = 0; j < this.audioIntensitiesArray.length; j++) {
      this.avgAudioIntensity += this.audioIntensitiesArray[j];
    }
    this.avgAudioIntensity /= this.audioIntensitiesArray.length;
  }

  static _adjustSpectrumAlpha(spectrum) {
    const FIRE_THRESHOLD = 7;
    const MAX_FIRE_ALPHA = 1.0;
    const FULL_ON_FIRE = 100;
    for (let i = 0; i < spectrum.length; i++) {
      if (i >= FIRE_THRESHOLD) {
        spectrum[i][3] = MAX_FIRE_ALPHA * ((i > FULL_ON_FIRE) ? 1.0 : (i - FIRE_THRESHOLD)/(FULL_ON_FIRE - FIRE_THRESHOLD));
      }
      else {
        spectrum[i][0] = spectrum[i][1] = spectrum[i][2] = spectrum[i][3] = 0;
      }
    }
    return spectrum;
  }

  genFireColourLookup() {
    const {colourMode, spectrumTempMin, spectrumTempMax, colourSystem, colourInterpolationType} = this.config;

    let spectrum = null;
    switch (colourMode) {
      case LOW_HIGH_TEMP_COLOUR_MODE: {
        const {highTempColour, lowTempColour} = this.config;
        spectrum = Spectrum.genLowToHighColourSpectrum(lowTempColour, highTempColour, colourInterpolationType);
        break;
      }
      case TEMPERATURE_COLOUR_MODE:
        spectrum = Spectrum.generateSpectrum(spectrumTempMin, spectrumTempMax, FIRE_SPECTRUM_WIDTH, ColourSystems[colourSystem]);
        break;
      case RANDOM_COLOUR_MODE: {
        const {highTempColour, lowTempColour} = this.randomColourCycler.currRandomColours;
        this.colourHoldTimeCounter = 0;
        spectrum = Spectrum.genLowToHighColourSpectrum(lowTempColour, highTempColour, colourInterpolationType);
        break;
      }

      default:
        console.error("Invalid fire colour mode: " + colourMode);
        this.fireLookup = null;
        break;
    }

    spectrum = FireAnimator._adjustSpectrumAlpha(spectrum);
    this.fireLookup = spectrum;
  }

  _genRandomTemperatureFunc(x, y, sx, sy, t) {
    let f = 0;
    let i = 0;

    const _randomValue = () => {
      const result = this.randomArray[this.randIdx];
      this.randIdx = (this.randIdx+1) % this.randomArray.length;
      return result;
    };

    for (; i < 12; i++) {
      f += (1.0 +
        Math.sin(x/sx*PI2*(_randomValue()+1) + _randomValue()*PI2 + _randomValue()*t) *
        Math.sin(y/sy*PI2*(_randomValue()+1) + _randomValue()*PI2 + _randomValue()*t)) *
        (1 + Math.sin((_randomValue()+0.5)*t + _randomValue()*PI2)) * 0.25;
    }
    f *= 1.0/i;

    let fx = (x < sx*0.9) ? 1.0 : 1.0-(x-sx*0.9)/(sx*0.2);
    if (x < sx*0.1) {
      fx = 0.5 + x/(sx*0.2);
    }
    let fy = (y < sy*0.9) ? 1.0 : 1.0-(y-sy*0.9)/(sy*0.2);
    if (y < sy*0.1) {
      fy = 0.5 + y/(sy*0.2);
    }

    return f * fx * fy;
  }
  _genAudioTemperatureFunc(x, y, sx, sy, t) {
    const {audioNoiseAddition} = this.config;

    let f = 0;
    let i = 0;
    
    const _randomValue = () => {
      const result = this.audioIntensitiesArray[this.randIdx] + this.randomArray[this.randIdx];
      this.randIdx = (this.randIdx+1) % this.audioIntensitiesArray.length;
      return result;
    };
    const multiplier = 2*Math.max(this.avgAudioIntensity, audioNoiseAddition/8);
    for (; i < 12; i++) {
      f += (1.0 +
        Math.sin(x/sx*PI2*(_randomValue()+1)+(_randomValue())*PI2 + (_randomValue())*t) *
        Math.sin(y/sy*PI2*(_randomValue()+1)+(_randomValue())*PI2 + (_randomValue())*t)) *
        (1 + Math.sin((_randomValue()+0.5)*t + (_randomValue())*PI2)) * multiplier;
    }
    f /= i;

    let fx = (x < sx*0.9) ? 1.0 : 1.0-(x-sx*0.9)/(sx*0.2);
    if (x < sx*0.1) {
      fx = 0.5 + x/(sx*0.2);
    }
    let fy = (y < sy*0.9) ? 1.0 : 1.0-(y-sy*0.9)/(sy*0.2);
    if (y < sy*0.1) {
      fy = 0.5 + y/(sy*0.2);
    }

    return f * fx * fy;
  }


}

export default FireAnimator;