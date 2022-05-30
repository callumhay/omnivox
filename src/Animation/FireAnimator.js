import FireGPU from '../FireGPU';
import Spectrum, {ColourSystems, FIRE_SPECTRUM_WIDTH, COLOUR_INTERPOLATION_LRGB} from '../Spectrum';
import {PI2, clamp} from '../MathUtils';

import VoxelAnimator from './VoxelAnimator';
import AudioVisualizerAnimator from './AudioVisualizerAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';
import {Randomizer, RandomHighLowColourCycler} from '../Randomizers';

// Fire colour types
const LOW_HIGH_TEMP_COLOUR_MODE = "Low High Temp";
const TEMPERATURE_COLOUR_MODE   = "Temperature";
const RANDOM_COLOUR_MODE        = "Random";
const COLOUR_MODES = [
  LOW_HIGH_TEMP_COLOUR_MODE,
  TEMPERATURE_COLOUR_MODE,
  RANDOM_COLOUR_MODE,
];

export const fireAnimatorDefaultConfig = {
  speed: 2.0,
  buoyancy: 1,
  cooling: 0.5,
  initialIntensityMultiplier: 8,
  vorticityConfinement: 8,

  colourMode: TEMPERATURE_COLOUR_MODE,
  colourInterpolationType: COLOUR_INTERPOLATION_LRGB,

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
  audioSpeedMultiplier: 0.25,
  audioCoolingMultiplier: 0.1,
  audioBuoyancyMultiplier: 1,
  audioTurbulenceMultiplier: 5,
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
  static get COLOUR_MODES() { return COLOUR_MODES; }

  constructor(voxelModel, config=fireAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_FIRE; }

  load() {
    super.load();
    this.randomColourCycler = new RandomHighLowColourCycler();

    this.fluidModel = new FireGPU(this.voxelModel.gridSize, this.voxelModel.gpuKernelMgr);
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;

    this.fluidModelOffsets = {startX:1, endX:this.voxelModel.xSize()+1, startY:1, startZ:1, endZ:this.voxelModel.zSize()+1};
    const {startX, endX, startY, startZ, endZ} = this.fluidModelOffsets;
    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        this.fluidModel.sd[x][startY][z] = 1.0;
      }
    }

    const INTENSITY_ARRAY_SIZE = Math.pow(this.voxelModel.gridSize,2);
    this.audioIntensitiesArray = new Array(INTENSITY_ARRAY_SIZE).fill(0);
    this.randomArray = new Array(INTENSITY_ARRAY_SIZE).fill(0);

    this.fireLookup = new Array(FIRE_SPECTRUM_WIDTH).fill(null);

    this._reinitTimersAndAudioParams();
  }
  unload() {
    super.unload();
    this.randomColourCycler = null;
    if (this.fluidModel) {
      this.fluidModel.unload(); // Clears GPU buffers
      this.fluidModel = null;
    }
    this.fluidModelOffsets = null;
    this.audioIntensitiesArray = null;
    this.randomArray = null;
    this.fireLookup = null;
    this.binIndexLookup = null;
    this.updateGamma = false;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c,init)) { return; }

    const {
      randomColourHoldTime, randomColourTransitionTime,
      audioVisualizationOn, audioNoiseAddition, buoyancy, cooling, vorticityConfinement,
      wallPosX, wallNegX, wallPosY, wallPosZ, wallNegZ,
      colourMode, spectrumTempMin, spectrumTempMax, colourSystem, colourInterpolationType
    } = this.config;

    this.randomColourCycler.setConfig({randomColourHoldTime, randomColourTransitionTime});

    Randomizer.getRandomFloats(this.randomArray, 0, audioVisualizationOn ? audioNoiseAddition : 1);

    this.fluidModel.buoyancy  = buoyancy;
    this.fluidModel.cooling   = cooling;
    this.fluidModel.vc_eps    = vorticityConfinement;
    this.fluidModel.setBoundary({
      posXOffset:wallPosX, negXOffset:wallNegX, 
      posYOffset:wallPosY, negYOffset:-1,
      posZOffset:wallPosZ, negZOffset:wallNegZ
    });

    switch (colourMode) {
      default:
      case LOW_HIGH_TEMP_COLOUR_MODE: {
        const {highTempColour, lowTempColour} = this.config;
        Spectrum.getLowToHighColourSpectrum(this.fireLookup, lowTempColour, highTempColour, colourInterpolationType);
        break;
      }
      case TEMPERATURE_COLOUR_MODE:
        Spectrum.getSpectrum(this.fireLookup, spectrumTempMin, spectrumTempMax, ColourSystems[colourSystem]);
        break;
      case RANDOM_COLOUR_MODE: {
        const {highTempColour, lowTempColour} = this.randomColourCycler.currRandomColours;
        this.colourHoldTimeCounter = 0;
        Spectrum.getLowToHighColourSpectrum(this.fireLookup, lowTempColour, highTempColour, colourInterpolationType);
        break;
      }
    }
    FireAnimator.adjustSpectrumAlpha(this.fireLookup);
    this.updateGamma = true;
  }

  reset() {
    super.reset();
    this.randomColourCycler.reset();
    this._reinitTimersAndAudioParams();
  }

  _reinitTimersAndAudioParams() {
    this.t = 0;
    this.avgSpectralCentroid = 0;
    this.avgNormalizedSpectralCentroid = 0;
    this.avgAudioIntensity = 0;
    this.prevAudioMultiplier = 0;
    this.updateGamma = true;
  }

  render(dt) {
    const {speed, initialIntensityMultiplier, audioVisualizationOn, audioSpeedMultiplier, colourMode} = this.config;

    // Offsets are used because the fluid model has two extra values on either side of each buffer in all dimensions in order
    // to properly calculate the derivatives within the grid. We need to get the values inside that margin and place them
    // into our voxel grid.
    const {startX, endX, startY, startZ, endZ} = this.fluidModelOffsets;
    const genFunc = audioVisualizationOn ? this._genAudioTemperatureFunc.bind(this) : this._genRandomTemperatureFunc.bind(this);
    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        this.fluidModel.sT[x][startY][z] = 1.0 + genFunc(x-startX, z-startZ, endX-startX, endZ-startZ, this.t)*initialIntensityMultiplier;
      }
    }

    const clampDt = Math.min(dt, 1/15); // Make sure our timesteps aren't too big or it will cause instability in the fire simulation
    const nWeightedRMSZCR = 0.25*this.avgRMSPercent() + 0.75*this.avgZCRPercent();
    const currSpeed = audioVisualizationOn ? speed + audioSpeedMultiplier*nWeightedRMSZCR : speed;
    const dtSpeed = clampDt*currSpeed;
    this.fluidModel.step(dtSpeed);
    this.t += dtSpeed;

    // In random colour mode we're animating the colour over time, check to see if it has changed and update it accordingly
    if (colourMode === RANDOM_COLOUR_MODE) {
      const {colourInterpolationType} = this.config;
      const currColours = this.randomColourCycler.tick(dt, colourInterpolationType);
      Spectrum.getLowToHighColourSpectrum(this.fireLookup, currColours.lowTempColour, currColours.highTempColour, colourInterpolationType);
      FireAnimator.adjustSpectrumAlpha(this.fireLookup);
    }

    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    gpuFramebuffer.drawFire(this.fireLookup, this.fluidModel.T, [startX, startY, startZ]);
  }

  setAudioInfo(audioInfo) {
    if (!this.config.audioVisualizationOn) { return; }
    super.setAudioInfo(audioInfo);

    const {
      gamma, levelMax, audioBuoyancyMultiplier, audioCoolingMultiplier, audioTurbulenceMultiplier, 
      buoyancy, cooling, vorticityConfinement
    } = this.config;
    const {fft, spectralCentroid, rms} = audioInfo;
    const audioIntensityArrLen = this.audioIntensitiesArray.length;

    // Build a distribution of what bins (i.e., meshes) to throw each frequency in
    if (!this.binIndexLookup || this.updateGamma) {
      this.binIndexLookup = AudioVisualizerAnimator.buildBinIndexLookup(fft.length, audioIntensityArrLen, gamma);
      this.updateGamma = false;
    }

    this.avgAudioIntensity = 0;
    for (let i = 0; i < audioIntensityArrLen; i++) {
      const fftIndices = this.binIndexLookup[i];
      const binLevel = AudioVisualizerAnimator.calcFFTBinLevelMax(fftIndices, fft);
      this.audioIntensitiesArray[i] = clamp(Math.log10(binLevel)/levelMax, 0, 1);
      this.avgAudioIntensity += this.audioIntensitiesArray[i];
    }
    this.avgAudioIntensity /= audioIntensityArrLen;

    // Update the fluid model levers based on the current audio
    this.avgSpectralCentroid = (this.avgSpectralCentroid + spectralCentroid) / 2.0;
    this.avgNormalizedSpectralCentroid = clamp(this.avgSpectralCentroid / (fft.length / 2), 0, 1);

    const nAudioIntensity = clamp(this.avgAudioIntensity, 0, 1);
    const nZCR = this.avgZCRPercent();
    this.fluidModel.buoyancy = buoyancy + (clamp(this.avgNormalizedSpectralCentroid * 10, 0, 3) * audioBuoyancyMultiplier);
    this.fluidModel.cooling  = cooling + clamp((1.0 - nAudioIntensity) * audioCoolingMultiplier, 0.1, 2); // Values range from [0.1, 2] where lower values make the fire brighter/bigger
    this.fluidModel.vc_eps   = vorticityConfinement + (nZCR * audioTurbulenceMultiplier);
  }

  static adjustSpectrumAlpha(spectrum) {
    const FIRE_THRESHOLD = 7;
    const MAX_FIRE_ALPHA = 1.0;
    const FULL_ON_FIRE = 100;
    for (let i = 0, spectrumLen = spectrum.length; i < spectrumLen; i++) {
      if (i >= FIRE_THRESHOLD) {
        spectrum[i][3] = MAX_FIRE_ALPHA * ((i > FULL_ON_FIRE) ? 1.0 : (i - FIRE_THRESHOLD)/(FULL_ON_FIRE - FIRE_THRESHOLD));
      }
      else {
        spectrum[i][0] = spectrum[i][1] = spectrum[i][2] = spectrum[i][3] = 0;
      }
    }
    return spectrum;
  }

  _genRandomTemperatureFunc(x, y, sx, sy, t) {
    let f = 0, i = 0;
    let randIdx = Randomizer.getRandomInt(0,this.randomArray.length);
    const _randomValue = () => {
      const result = this.randomArray[randIdx];
      randIdx = (randIdx+1) % this.randomArray.length;
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
    if (x < sx*0.1) { fx = 0.5 + x/(sx*0.2); }
    let fy = (y < sy*0.9) ? 1.0 : 1.0-(y-sy*0.9)/(sy*0.2);
    if (y < sy*0.1) { fy = 0.5 + y/(sy*0.2); }

    return f * fx * fy;
  }
  _genAudioTemperatureFunc(x, y, sx, sy, t) {
    const {audioNoiseAddition} = this.config;

    let f = 0, i = 0;
    let randIdx = Randomizer.getRandomInt(0,this.randomArray.length);
    const _randomValue = () => {
      const result = this.audioIntensitiesArray[randIdx] + this.randomArray[randIdx];
      randIdx = (randIdx+1) % this.audioIntensitiesArray.length;
      return result;
    };

    const currLogRMSPct = this.avgRMSPercent();
    this.prevAudioMultiplier = 0.5*this.prevAudioMultiplier + 0.5*(this.avgAudioIntensity + 0.1*currLogRMSPct + audioNoiseAddition/8);
    for (; i < 12; i++) {
      f += (1.0 +
        Math.sin(x/sx*PI2*(_randomValue()+1)+(_randomValue())*PI2 + (_randomValue())*t) *
        Math.sin(y/sy*PI2*(_randomValue()+1)+(_randomValue())*PI2 + (_randomValue())*t)) *
        (1 + Math.sin((_randomValue()+0.5)*t + (_randomValue())*PI2)) * this.prevAudioMultiplier;
    }
    f /= i;

    let fx = (x < sx*0.9) ? 1.0 : 1.0-(x-sx*0.9)/(sx*0.2);
    if (x < sx*0.1) { fx = 0.5 + x/(sx*0.2); }
    let fy = (y < sy*0.9) ? 1.0 : 1.0-(y-sy*0.9)/(sy*0.2);
    if (y < sy*0.1) { fy = 0.5 + y/(sy*0.2); }

    return f * fx * fy;
  }

}

export default FireAnimator;
