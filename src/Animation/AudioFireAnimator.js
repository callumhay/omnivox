import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {Randomizer} from './Randomizers';

import AudioVisUtils from '../VoxelTracer/Scenes/Audio/AudioVisUtils';

import Fluid, {_I} from '../Fluid';
import {PI2, clamp, VOXEL_EPSILON} from '../MathUtils';

const SPECTRUM_WIDTH = 256;

export const audioFireAnimatorDefaultConfig = {
  speedMultiplier: 1,
  coolingMultiplier: 1,
  boyancyMultiplier: 1,
  lowTempColour:  new THREE.Color(135/255, 1, 0),
  highTempColour: new THREE.Color(1, 0, 180/255),
};

class AudioFireAnimator extends VoxelAnimator {
  constructor(voxels, config) {
    super(voxels, config);
    this.reset();
  }

  setConfig(c) {
    super.setConfig(c);

    if (!this.initArray) {
      this.initArray = Randomizer.getRandomFloats(SPECTRUM_WIDTH);
    }

    // Setup basic defaults for the fire's fluid model - these will immediately be modified based on the audio
    if (!this.fluidModel) {
      this.fluidModel = new Fluid(this.voxelModel);
    }
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = 5.4;
    this.fluidModel.cooling   = 1.3;
    this.fluidModel.vc_eps    = 8;

    this._genFireColourLookup();
  }

  render(dt) {
    super.render(dt);

    const startX = 1;
    const endX = this.voxelModel.xSize()-startX;
    const startZ = 1;
    const endZ = this.voxelModel.zSize()-startZ;
    const endY = this.voxelModel.ySize();

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        let f = this._genFunc(x-startX, z-startZ, endX-startX, endY, this.t, this.initArray);
        this.fluidModel.sd[this.fluidModel._I(x, 1, z)] = 1.0;
        this.fluidModel.sT[this.fluidModel._I(x, 1, z)] = 1.0 + f*8.0;
      }
    }

    const {speedMultiplier} = this.config.sceneConfig;
    const currSpeed = speedMultiplier * (2 + clamp(THREE.MathUtils.smootherstep(this.avgBeatsPerSec, 0, 80), 0, 0.75));
    //console.log(currSpeed);

    const speedDt = dt*currSpeed;
    this.fluidModel.step(speedDt);
    this.t += speedDt;

    // Update the voxels...
    const xSize = this.voxelModel.xSize();
    const ySize = this.voxelModel.ySize();
    const zSize = this.voxelModel.zSize();

    for (let x = 0; x < xSize; x++) {
      for (let y = 0; y < ySize; y++) {
        for (let z = 0; z < zSize; z++) {

          // Start by looking up the temperature and density of the flame, both are constrained in [0,1]
          const temperature = this.fluidModel.T[this.fluidModel._I(x,y,z)];
          const density = this.fluidModel.d[this.fluidModel._I(x,y,z)];
          const lighting = 0.6;

          // Use the temp and density to look up the expected colour of the flame at the current voxel
          const temperatureIdx = Math.min(SPECTRUM_WIDTH-1, Math.max(0, Math.round(temperature*(SPECTRUM_WIDTH-1))));
          const densityIdx = Math.min(15, Math.max(0, Math.round(density*15)));
          const intensityIdx = Math.round(lighting*15);

          const voxelColour = this.fireTexture[intensityIdx][densityIdx][temperatureIdx];
          this.voxelModel.drawPoint(new THREE.Vector3(x,y,z), new THREE.Color(voxelColour.a*voxelColour.r, voxelColour.a*voxelColour.g, voxelColour.a*voxelColour.b));
        }
      }
    }
  }

  rebuild(config) {
    this.setConfig(config);
    this.reset();
  }

  reset() {
    super.reset();
    this.t = 0;
    this.avgSpectralCentroid = 0;
    this.avgRMS = 0;
    this.lastAudioFrameTime = Date.now();
    this.currAudioFrameTime = this.lastAudioFrameTime;
    this.dRMSAvg = 0;
    this.avgBeatsPerSec = 0;
    this.lastdRMS = 0;
    this.avgBeatsPerSec = 0;
    this.timeSinceLastBeat = 1;
  }

  clear() {}

  updateAudioInfo(audioInfo) {
    const {gamma, levelMax} = this.config;
    const {boyancyMultiplier, coolingMultiplier} = this.config.sceneConfig;
    const {fft, rms, spectralCentroid} = audioInfo;

    // Use the FFT array to populate the initialization array for the fire
    let numFreqs = Math.floor(fft.length/(gamma+1.8));

    // Build a distribution of what bins (i.e., meshes) to throw each frequency in
    if (!this.binIndexLookup || numFreqs !== this.binIndexLookup.length) {
      this.binIndexLookup = AudioVisUtils.buildBinIndexLookup(numFreqs, this.initArray.length, gamma);
    }

    for (let i = 0; i < this.initArray.length; i++) {
      const fftIndices = this.binIndexLookup[i];
      const binLevel = AudioVisUtils.calcFFTBinLevelMax(fftIndices, fft);
      this.initArray[i] = THREE.MathUtils.smootherstep(binLevel/levelMax, 0, 1);
    }

    // Update the fluid model levers based on the current audio
    const denoisedRMS = rms < 0.01 ? 0 : rms;
    this.avgRMS = (this.avgRMS + denoisedRMS) / 2.0;
    this.avgSpectralCentroid = (this.avgSpectralCentroid + spectralCentroid) / 2.0;

    const normalizedSC = clamp(this.avgSpectralCentroid/(fft.length/2), 0, 1);
    const boyancyVal = clamp(normalizedSC * 30, 1, 5);
    //console.log(boyancyVal);
    //console.log(normalizedSC);
    //console.log(this.avgRMS);

    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = boyancyVal * boyancyMultiplier;
    this.fluidModel.cooling   = 0.1 + (1.0 - this.avgRMS) * 1.1 * coolingMultiplier; // Values range from [0.1, 2] where lower values make the fire brighter/bigger
    this.fluidModel.vc_eps    = this.avgRMS*100;

    this.currAudioFrameTime = Date.now();
    const dt = (this.currAudioFrameTime - this.lastAudioFrameTime) / 1000;
    this.lastAudioFrameTime = this.currAudioFrameTime;

    this.dRMSAvg = (this.dRMSAvg + (denoisedRMS - this.lastRMS) / dt) / 2.0;
    if (this.timeSinceLastBeat > 0.001 && (this.dRMSAvg < 0 && this.lastdRMS > 0) || (this.dRMSAvg > 0 && this.lastdRMS < 0)) {
      // We crossed zero, count the beat
      this.avgBeatsPerSec = 1.0 / this.timeSinceLastBeat;
      this.timeSinceLastBeat = 0;
    }
    else {
      this.timeSinceLastBeat += dt;
      if (this.timeSinceLastBeat > 1) {
        this.avgBeatsPerSec = 0.01;
      }
    }
    
    this.lastRMS  = denoisedRMS;
    this.lastdRMS = this.dRMSAvg;
  }

  _genCustomColourSpectrum(lowTempColour, highTempColour, spectrumWidth) {
    let result = new Array(spectrumWidth);
    let j = spectrumWidth-1;
    //const rgbEpsilon = 1.0 / 256;
    for (let i = 0; i < spectrumWidth; i++) {
      const t = THREE.MathUtils.smootherstep(i, 0, spectrumWidth-1);
      const rgb = new THREE.Color(lowTempColour.r, lowTempColour.g, lowTempColour.b).lerp(highTempColour, t);

      result[j] = {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: ((rgb.r + rgb.g + rgb.b) > 0.1) ? rgb.b : 0
      };
      j--;
    }

    return result;
  }

  _genFireColourLookup() {
    const FIRE_THRESHOLD = 7;
    const MAX_FIRE_ALPHA = 1.0;
    const FULL_ON_FIRE   = 100;

    const {lowTempColour, highTempColour} = this.config.sceneConfig;

    const spectrum = this._genCustomColourSpectrum(lowTempColour, highTempColour, SPECTRUM_WIDTH);
    this.fireTexture = [];

    // Create a (16 x 16 x SPECTRUM_WIDTH) 3D texture array for looking up encoded colour based on fire characteristics
    for (let i = 0; i < 16; i++) {
      let iTex = [];
      this.fireTexture.push(iTex);

      for (let j = 0; j < 16; j++) {
        let jTex = [];
        iTex.push(jTex);

        for (let k = 0; k < SPECTRUM_WIDTH; k++) {
          //let intensity = i/16.0;
          //let density = j/16.0;
          //let temperature = k/SPECTRUM_WIDTH;
          
          if (k >= FIRE_THRESHOLD) {
            const currSpectrumVal = spectrum[k];
            jTex.push({
              r: currSpectrumVal.r,
              g: currSpectrumVal.g,
              b: currSpectrumVal.b,
              a: MAX_FIRE_ALPHA * ((k>FULL_ON_FIRE) ? 1.0 : (k-FIRE_THRESHOLD)/(FULL_ON_FIRE-FIRE_THRESHOLD))
            });
          }
          else {
            jTex.push({r: 0, g: 0, b: 0, a: 0});
          }
        }
      }
    }
  }

  _genFunc(x, y, sx, sy, t, p) {
    let pi = 0;
    let f = 0;
    let i = 0;

    for (; i < 12; i++) {
      f += (1.0 +
        Math.sin(x/sx*PI2*(p[pi++]+1)+p[pi++]*PI2 + p[pi++]*t) *
        Math.sin(y/sy*PI2*(p[pi++]+1)+p[pi++]*PI2 + p[pi++]*t)) *
        (1 + Math.sin((p[pi++]+0.5)*t + p[pi++]*PI2)) * 0.25;
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
}

export default AudioFireAnimator;