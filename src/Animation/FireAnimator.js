import * as THREE from 'three';
import chroma from 'chroma-js';

import VoxelAnimator from './VoxelAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';
import {Randomizer} from './Randomizers';

import AudioVisUtils from '../VoxelTracer/Scenes/Audio/AudioVisUtils';

import FluidGPU from '../FluidGPU';
import {generateSpectrum, ColourSystems, FIRE_SPECTRUM_WIDTH, COLOUR_INTERPOLATION_RGB} from '../Spectrum';
import {PI2, clamp} from '../MathUtils';

const REINIT_FLUID_TIME_SECS = 0.1;
const MAX_AVG_BEATS_PER_SEC = 120;

// Fire colour types
export const LOW_HIGH_TEMP_COLOUR_MODE = "Low/High Temp";
export const TEMPERATURE_COLOUR_MODE   = "Temperature";
export const RANDOM_COLOUR_MODE        = "Random";

export const COLOUR_MODES = [
  LOW_HIGH_TEMP_COLOUR_MODE,
  TEMPERATURE_COLOUR_MODE,
  RANDOM_COLOUR_MODE,
];

export const fireAnimatorDefaultConfig = {
  speed: 2.0,
  buoyancy: 1.2,
  cooling: 1,
  initialIntensityMultiplier: 8,
  vorticityConfinement: 8.0,

  colourMode: TEMPERATURE_COLOUR_MODE,
  colourInterpolationType: COLOUR_INTERPOLATION_RGB,

  // Temperature Colour Mode
  spectrumTempMin: 500,
  spectrumTempMax: 1700,
  colourSystem: 'CIEsystem',
  // Low-High Colour Mode
  lowTempColour:  new THREE.Color(0.2, 0, 1),
  highTempColour: new THREE.Color(1, 0, 0.7),
  // Random Colour Mode
  randomColourHoldTime: 5,
  randomColourTransitionTime: 2,

  ...soundVisDefaultConfig,
  levelMax: 1.3,
  audioVisualizationOn: false,
  audioSpeedMultiplier: 0,
  audioCoolingMultiplier: 0.1,
  audioBuoyancyMultiplier: 1,
  audioTurbulenceMultiplier: 1,
  audioNoiseAddition: 0.25,
};

class FireAnimator extends VoxelAnimator {
  constructor(voxelModel, config=fireAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_FIRE; }

  setConfig(c) {
    super.setConfig(c);

    const {audioVisualizationOn, audioNoiseAddition, buoyancy, cooling, vorticityConfinement} = c;
    this.audioIntensitiesArray = Randomizer.getRandomFloats(FIRE_SPECTRUM_WIDTH);
    this.randomArray = Randomizer.getRandomFloats(FIRE_SPECTRUM_WIDTH, 0, audioVisualizationOn ? audioNoiseAddition : 1);

    if (!this.fluidModel) {
      this.fluidModel = new FluidGPU(this.voxelModel.gridSize, this.voxelModel.gpuKernelMgr.gpu);
    }
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = buoyancy;
    this.fluidModel.cooling   = cooling;
    this.fluidModel.vc_eps    = vorticityConfinement;

    const {startX, endX, startY, startZ, endZ} = this._getFluidModelOffsets();
    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        this.fluidModel.sd[x][startY][z] = 1.0;
      }
    }
    
    this.genFireColourLookup();
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

    const currSpeed = audioVisualizationOn ? speed + audioSpeedMultiplier*(1 + THREE.MathUtils.lerp(0, 0.5, this.avgBeatsPerSec/MAX_AVG_BEATS_PER_SEC)) : speed;
    const dtSpeed = dt*currSpeed;
    this.fluidModel.step(dtSpeed);
    this.t += dtSpeed;

    // In random colour mode we're animating the colour over time, check to see if it has changed and update it accordingly
    if (colourMode === RANDOM_COLOUR_MODE) {
      const {colourInterpolationType, randomColourHoldTime, randomColourTransitionTime} = this.config;

      if (this.colourHoldTimeCounter >= randomColourHoldTime) {
        // We're transitioning between random colours, interpolate from the previous to the next
        const interpolationVal = this.colourTransitionTimeCounter / randomColourTransitionTime;

        const {lowTempColour:currLowTC, highTempColour:currHighTC} = this.currRandomColours;
        const {lowTempColour:nextLowTC, highTempColour:nextHighTC} = this.nextRandomColours;

        const tempLowTempColour = chroma.mix(
          chroma.gl([currLowTC.r, currLowTC.g, currLowTC.b, 1]), 
          chroma.gl([nextLowTC.r, nextLowTC.g, nextLowTC.b, 1]), 
          interpolationVal, colourInterpolationType
        ).gl();
        const tempHighTempColour = chroma.mix(
          chroma.gl([currHighTC.r, currHighTC.g, currHighTC.b, 1]), 
          chroma.gl([nextHighTC.r, nextHighTC.g, nextHighTC.b, 1]), 
          interpolationVal, colourInterpolationType
        ).gl();
        
        const finalLowTempColour = new THREE.Color(tempLowTempColour[0], tempLowTempColour[1], tempLowTempColour[2]);
        const finalHighTempColour = new THREE.Color(tempHighTempColour[0], tempHighTempColour[1], tempHighTempColour[2]);
        this.fireLookup = FireAnimator._adjustSpectrumAlpha(this._genHighLowColourSpectrum(finalHighTempColour, finalLowTempColour));
        
        this.colourTransitionTimeCounter += dt;
        if (this.colourTransitionTimeCounter >= randomColourTransitionTime) {
          this.currRandomColours = this.nextRandomColours;
          this.nextRandomColours = this._genRandomFireColours(this.currRandomColours);
          this.colourTransitionTimeCounter -= randomColourTransitionTime;
          this.colourHoldTimeCounter -= randomColourHoldTime;
        }
      }
      else {
        this.colourHoldTimeCounter += dt;
      }
    }

    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    gpuFramebuffer.drawFire(this.fireLookup, this.fluidModel.T, [startX, startY, startZ]);
  }

  reset() {
    super.reset();
    
    this.t = 0;
    this.timeCounterToReinitFluid = Infinity;
    this.randIdx = 0;

    this.colourTransitionTimeCounter = 0;
    this.colourHoldTimeCounter = 0;
    this.currRandomColours = this._genRandomFireColours();
    this.nextRandomColours = this._genRandomFireColours(this.currRandomColours);

    this._resetAudioVars();
  }
  _resetAudioVars() {
    this.avgSpectralCentroid = 0;
    this.avgNormalizedSpectralCentroid = 0;
    this.avgRMS = 0;
    this.lastAudioFrameTime = Date.now();
    this.currAudioFrameTime = this.lastAudioFrameTime;
    this.dRMSAvg = 0;
    this.avgBeatsPerSec = 0;
    this.lastdRMS = 0;
    this.lastRMS = 0;
    this.avgBeatsPerSec = 0;
    this.timeSinceLastBeat = 1;
  }

  setAudioInfo(audioInfo) {
    if (!this.config.audioVisualizationOn) {
      return;
    }

    const {gamma, levelMax, audioBuoyancyMultiplier, audioCoolingMultiplier, audioTurbulenceMultiplier, buoyancy, cooling, vorticityConfinement} = this.config;
    const {fft, rms, spectralCentroid} = audioInfo;

    // Use the FFT array to populate the initialization array for the fire
    let numFreqs = Math.floor(fft.length/(gamma+1.8));

    // Build a distribution of what bins (i.e., meshes) to throw each frequency in
    if (!this.binIndexLookup || numFreqs !== this.binIndexLookup.length) {
      this.binIndexLookup = AudioVisUtils.buildBinIndexLookup(numFreqs, this.audioIntensitiesArray.length, gamma);
    }

    for (let i = 0; i < this.audioIntensitiesArray.length; i++) {
      const fftIndices = this.binIndexLookup[i];
      const binLevel = AudioVisUtils.calcFFTBinLevelMax(fftIndices, fft);
      this.audioIntensitiesArray[i] = clamp(Math.log10(binLevel)/levelMax, 0, 1);
    }

    // Update the fluid model levers based on the current audio
    const denoisedRMS = rms < 0.01 ? 0 : rms;
    this.avgRMS = (this.avgRMS + denoisedRMS) / 2.0;
    this.avgSpectralCentroid = (this.avgSpectralCentroid + spectralCentroid) / 2.0;
    this.avgNormalizedSpectralCentroid = clamp(this.avgSpectralCentroid / (fft.length / 2), 0, 1);
    const buoyancyVal = buoyancy + clamp(this.avgNormalizedSpectralCentroid * 10, 0, 3);

    this.fluidModel.buoyancy = buoyancyVal * audioBuoyancyMultiplier;
    this.fluidModel.cooling  = cooling + clamp((1.0 - this.avgRMS) * audioCoolingMultiplier, 0, 2); // Values range from [0.1, 2] where lower values make the fire brighter/bigger
    this.fluidModel.vc_eps   = vorticityConfinement + (this.avgRMS * 30 * audioTurbulenceMultiplier);

    this.currAudioFrameTime = Date.now();
    const dt =  Math.max(0.000001, (this.currAudioFrameTime - this.lastAudioFrameTime) / 1000);
    this.lastAudioFrameTime = this.currAudioFrameTime;

    this.dRMSAvg = (this.dRMSAvg + (denoisedRMS - this.lastRMS) / dt) / 2.0;
    if (this.timeSinceLastBeat > 0.001 && (this.dRMSAvg < 0 && this.lastdRMS > 0) || (this.dRMSAvg > 0 && this.lastdRMS < 0)) {
      // We crossed zero, count the beat
      this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 1.0 / this.timeSinceLastBeat) / 2.0, 0, MAX_AVG_BEATS_PER_SEC);
      this.timeSinceLastBeat = 0;
    }
    else {
      this.timeSinceLastBeat += dt;
      if (this.timeSinceLastBeat > 1) {
        this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 0.01) / 2.0, 0, MAX_AVG_BEATS_PER_SEC);
      }
    }
    
    this.lastRMS  = denoisedRMS;
    this.lastdRMS = this.dRMSAvg;
  }

  _genHighLowColourSpectrum(highColour, lowColour) {
    const {colourInterpolationType} = this.config;
    const lowTempColourWithAlpha  = chroma.gl([lowColour.r, lowColour.g, lowColour.b, 1]);
    const highTempColourWithAlpha = chroma.gl([highColour.r, highColour.g, highColour.b, 1]);
    const spectrum = new Array(FIRE_SPECTRUM_WIDTH);
    for (let i = 0; i < FIRE_SPECTRUM_WIDTH; i++) {
      spectrum[i] = chroma.mix(lowTempColourWithAlpha, highTempColourWithAlpha, i / (FIRE_SPECTRUM_WIDTH - 1), colourInterpolationType).gl();
    }
    return spectrum;
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
    const {colourMode, spectrumTempMin, spectrumTempMax, colourSystem} = this.config;

    let spectrum = null;
    switch (colourMode) {
      case LOW_HIGH_TEMP_COLOUR_MODE: {
        const {highTempColour, lowTempColour} = this.config;
        spectrum = this._genHighLowColourSpectrum(highTempColour, lowTempColour);
        break;
      }
      case TEMPERATURE_COLOUR_MODE:
        spectrum = generateSpectrum(spectrumTempMin, spectrumTempMax, FIRE_SPECTRUM_WIDTH, ColourSystems[colourSystem]);
        break;
      case RANDOM_COLOUR_MODE: {
        const {highTempColour, lowTempColour} = this.currRandomColours;
        this.colourHoldTimeCounter = 0;
        spectrum = this._genHighLowColourSpectrum(highTempColour, lowTempColour);
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

  _genRandomFireColours(currRandomColours=null) {
    const BRIGHTEN_FACTOR = [0, 1];
    const LOW_TEMP_SATURATION = [0.75, 1.0];
    const LOW_TEMP_INTENSITY  = [0.33, 0.66];
    const HUE_DISTANCE_FROM_LOW_TEMP = [90,270];

    let nextHighTempColour = null;
    let nextLowTempColour  = null;

    const brightenFactor = Randomizer.getRandomFloat(BRIGHTEN_FACTOR[0], BRIGHTEN_FACTOR[1]);

    if (currRandomColours) {
      // Use the existing random colours as a jump-off point to make sure we don't repeat them consecutively
      const {lowTempColour} = currRandomColours;
      const lowTempChromaGl  = chroma.gl([lowTempColour.r, lowTempColour.g, lowTempColour.b, 1]);
      const lowTempChromaHsi = chroma(lowTempChromaGl).hsi();

      lowTempChromaHsi[0] = (lowTempChromaHsi[0] === NaN) ? Randomizer.getRandomFloat(0,360) : (lowTempChromaHsi[0] + Randomizer.getRandomFloat(60,300)) % 360;
      lowTempChromaHsi[1] = Randomizer.getRandomFloat(LOW_TEMP_SATURATION[0], LOW_TEMP_SATURATION[1]);
      lowTempChromaHsi[2] = Randomizer.getRandomFloat(LOW_TEMP_INTENSITY[0], LOW_TEMP_INTENSITY[1]);

      const highTempHue = (lowTempChromaHsi[0] + Randomizer.getRandomFloat(HUE_DISTANCE_FROM_LOW_TEMP[0], HUE_DISTANCE_FROM_LOW_TEMP[1])) % 360;
      const highTempChromaHsi = [highTempHue, 1, lowTempChromaHsi[2]];
      nextLowTempColour = chroma(lowTempChromaHsi, 'hsi').gl();
      nextLowTempColour = new THREE.Color(nextLowTempColour[0], nextLowTempColour[1], nextLowTempColour[2]);
      nextHighTempColour = chroma(highTempChromaHsi, 'hsi').brighten(brightenFactor).gl();
      nextHighTempColour = new THREE.Color(nextHighTempColour[0], nextHighTempColour[1], nextHighTempColour[2]);
    }
    else {
      // First time generation, pick some good random colours
      const lowTempChroma = chroma(
        Randomizer.getRandomFloat(0,360),
        Randomizer.getRandomFloat(LOW_TEMP_SATURATION[0], LOW_TEMP_SATURATION[1]),
        Randomizer.getRandomFloat(LOW_TEMP_INTENSITY[0], LOW_TEMP_INTENSITY[1]), 'hsi');
      const lowTempChromaGl = lowTempChroma.gl();
      nextLowTempColour = new THREE.Color(lowTempChromaGl[0], lowTempChromaGl[1], lowTempChromaGl[2]);

      const lowTempHsi = lowTempChroma.hsi();
      const highTempChromaGl = chroma((lowTempHsi[0] + 180) % 360, 1, lowTempHsi[2], 'hsi').brighten(brightenFactor).gl();
      nextHighTempColour = new THREE.Color(highTempChromaGl[0], highTempChromaGl[1], highTempChromaGl[2]);
    }

    return {
      highTempColour: nextHighTempColour,
      lowTempColour: nextLowTempColour
    };
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
    let avgAudio = 0;
    for (let j = 0; j < this.audioIntensitiesArray.length; j++) {
      avgAudio += this.audioIntensitiesArray[j];
    }
    avgAudio /= this.audioIntensitiesArray.length;

    let f = 0;
    let i = 0;
    
    const _randomValue = () => {
      const result = this.audioIntensitiesArray[this.randIdx] + this.randomArray[this.randIdx];
      this.randIdx = (this.randIdx+1) % this.audioIntensitiesArray.length;
      return result;
    };
    const multiplier = 2*Math.max(avgAudio, audioNoiseAddition/8);
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