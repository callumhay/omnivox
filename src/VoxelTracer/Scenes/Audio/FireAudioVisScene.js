import * as THREE from 'three';
import chroma from 'chroma-js';

import SceneRenderer from '../SceneRenderer';
import AudioVisUtils from './AudioVisUtils';

import VTVoxel from '../../VTVoxel';
import VTEmissionMaterial from '../../VTEmissionMaterial';

import {COLOUR_INTERPOLATION_RGB} from '../../../Spectrum';
import Fluid, {_I} from '../../../Fluid';
import {PI2, clamp} from '../../../MathUtils';

import {Randomizer} from '../../../Animation/Randomizers';

const SPECTRUM_WIDTH = 256;

export const fireAudioVisDefaultConfig = {
  initialIntensityMultiplier: 8,
  speedMultiplier: 1,
  coolingMultiplier: 1,
  boyancyMultiplier: 1,
  lowTempColour:  new THREE.Color(135/255, 1, 0),
  highTempColour: new THREE.Color(1, 0, 180/255),
  colourInterpolationType: COLOUR_INTERPOLATION_RGB,
};

class FireAudioVisScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
    
    
    // Setup basic defaults for the fire's fluid model - these will immediately be modified based on the audio
    this.fluidModel = new Fluid(voxelModel);
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = 5.4;
    this.fluidModel.cooling   = 1.3;
    this.fluidModel.vc_eps    = 8;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;

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

  build(options) {
    const xSize = this.voxelModel.xSize();
    const ySize = this.voxelModel.ySize();
    const zSize = this.voxelModel.zSize();
    this.initArray = Randomizer.getRandomFloats(xSize*zSize);
    //this.initArray = new Array(xSize*zSize).fill(0);

    if (!this._objectsBuilt) {

      this.voxels = new Array(xSize);
      for (let x = 0; x < xSize; x++) {
        const yVoxels = new Array(ySize);
        this.voxels[x] = yVoxels;
        for (let y = 0; y < ySize; y++) {
          const zVoxels = new Array(zSize);
          yVoxels[y] = zVoxels;
          for (let z = 0; z < zSize; z++) {
            zVoxels[z] = new VTVoxel(new THREE.Vector3(x,y,z), new VTEmissionMaterial(new THREE.Color(0,0,0), 1));
          }
        }
      }

      this._objectsBuilt = true;
    }

    for (let x = 0; x < xSize; x++) {
      for (let y = 0; y < ySize; y++) {
        for (let z = 0; z < zSize; z++) {
          this.scene.addObject(this.voxels[x][y][z]);
        }
      }
    }

    this._genFireColourLookup(options);
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const {speedMultiplier, initialIntensityMultiplier} = this._options.sceneConfig;

    const xSize = this.voxelModel.xSize();
    const ySize = this.voxelModel.ySize();
    const zSize = this.voxelModel.zSize();

    const startX = 1;
    const endX = xSize+1;
    const startZ = 1;
    const endZ = zSize+1;
    const startY = 1;

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        let f = this._genFunc(x-startX, z-startZ, endX-startX, endZ-startZ, this.t, this.initArray);
        const idx = this.fluidModel._I(x, startY, z);
        this.fluidModel.sd[idx] = 1.0;
        this.fluidModel.sT[idx] = 0.25*this.fluidModel.sT[idx] + 0.75*(1.0 + f*initialIntensityMultiplier);
      }
    }

    const currSpeed = speedMultiplier * (2 + clamp(THREE.MathUtils.smootherstep(this.avgBeatsPerSec, 0, 80), 0, 0.75));
    const speedDt = dt*currSpeed;
    this.fluidModel.step(speedDt);
    this.t += speedDt;

    // Update the voxels and render them
    for (let x = 0; x < xSize; x++) {
      for (let y = 0; y < ySize; y++) {
        for (let z = 0; z < zSize; z++) {

          // Start by looking up the temperature and density of the flame, both are constrained in [0,1]
          const idx = this.fluidModel._I(x+startX,y+startY,z+startZ);
          const temperature = this.fluidModel.T[idx];
          const density = this.fluidModel.d[idx];
          const lighting = 0.6;

          // Use the temp and density to look up the expected colour of the flame at the current voxel
          const temperatureIdx = Math.min(SPECTRUM_WIDTH-1, Math.max(0, Math.round(temperature*(SPECTRUM_WIDTH-1))));
          const densityIdx = Math.min(15, Math.max(0, Math.round(density*15)));
          const intensityIdx = Math.round(lighting*15);

          const voxelColour = this.fireTexture[intensityIdx][densityIdx][temperatureIdx];
          this.voxels[x][y][z].material.colour.setRGB(voxelColour.a*voxelColour.r, voxelColour.a*voxelColour.g, voxelColour.a*voxelColour.b);
        }
      }
    }

    this.scene.render();
  }

  updateAudioInfo(audioInfo) {
    const {gamma, levelMax} = this._options;
    const {boyancyMultiplier, coolingMultiplier} = this._options.sceneConfig;
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
      this.initArray[i] = clamp(Math.log10(binLevel)/levelMax, 0, 1);
    }
    //console.log(this.initArray);

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
    this.fluidModel.vc_eps    = this.avgRMS*80;

    this.currAudioFrameTime = Date.now();
    const dt = (this.currAudioFrameTime - this.lastAudioFrameTime) / 1000;
    this.lastAudioFrameTime = this.currAudioFrameTime;

    this.dRMSAvg = (this.dRMSAvg + (denoisedRMS - this.lastRMS) / dt) / 2.0;
    if (this.timeSinceLastBeat > 0.001 && (this.dRMSAvg < 0 && this.lastdRMS > 0) || (this.dRMSAvg > 0 && this.lastdRMS < 0)) {
      // We crossed zero, count the beat
      this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 1.0 / this.timeSinceLastBeat) / 2.0, 0, 80);
      this.timeSinceLastBeat = 0;
    }
    else {
      this.timeSinceLastBeat += dt;
      if (this.timeSinceLastBeat > 1) {
        this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 0.01) / 2.0, 0, 80);
      }
    }
    
    this.lastRMS  = denoisedRMS;
    this.lastdRMS = this.dRMSAvg;
  }

  _genCustomColourSpectrum(options, spectrumWidth) {
    const {lowTempColour, highTempColour, colourInterpolationType} = options.sceneConfig;

    let result = new Array(spectrumWidth);
    let j = spectrumWidth-1;
    for (let i = 0; i < spectrumWidth; i++) {
      const temp = chroma.mix(chroma.gl(highTempColour), chroma.gl(lowTempColour), i/(spectrumWidth-1), colourInterpolationType).gl();

      result[j] = {
        r: temp[0],
        g: temp[1],
        b: temp[2],
        a: ((temp[0] + temp[1] + temp[2]) > 0.1) ? temp[1] : 0
      };

      j--;
    }

    return result;
  }

  _genFireColourLookup(options) {
    const FIRE_THRESHOLD = 7;
    const MAX_FIRE_ALPHA = 1.0;
    const FULL_ON_FIRE   = 100;

    const spectrum = this._genCustomColourSpectrum(options, SPECTRUM_WIDTH);
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
              r: isNaN(currSpectrumVal.r) ? 0 : currSpectrumVal.r,
              g: isNaN(currSpectrumVal.g) ? 0 : currSpectrumVal.g,
              b: isNaN(currSpectrumVal.b) ? 0 : currSpectrumVal.b,
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

    let avgP = 0;
    let maxP = 0;
    for (let j = 0; j < p.length; j++) {
      avgP += p[j];
      maxP = Math.max(maxP, p[j]);
    }
    avgP /= p.length;
    const multiplier = maxP < 0.05 ? 0.0 : Math.min(avgP, 0.25);

    let f = 0;
    let i = 0;
    for (; i < p.length; i++) {
      const freqAvg = p[i];

      f += (1.0 +
        Math.sin(x/sx*PI2*(freqAvg+1)+freqAvg*PI2 + freqAvg*t) *
        Math.sin(y/sy*PI2*(freqAvg+1)+freqAvg*PI2 + freqAvg*t)) *
        (1 + Math.sin((freqAvg+0.5)*t + freqAvg*PI2)) * multiplier;
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

export default FireAudioVisScene;