import * as THREE from 'three';
import chroma from 'chroma-js';

import SceneRenderer from '../SceneRenderer';
import AudioVisUtils from './AudioVisUtils';

import VTVoxel from '../../VTVoxel';
import VTEmissionMaterial from '../../VTEmissionMaterial';
import Fluid, {_I} from '../../../Fluid';
import {PI2, clamp} from '../../../MathUtils';
import {FIRE_SPECTRUM_WIDTH} from '../../../Spectrum';
import {Randomizer} from '../../../Animation/Randomizers';

import {LOW_HIGH_TEMP_COLOUR_MODE, TEMPERATURE_COLOUR_MODE, RANDOM_COLOUR_MODE} from './AudioSceneDefaultConfigs';


const FIRE_THRESHOLD = 7;
const MAX_FIRE_ALPHA = 1.0;
const FULL_ON_FIRE   = 100;

class FireAudioVisScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
    
    // Setup basic defaults for the fire's fluid model - these will immediately be modified based on the audio
    this.fluidModel = new Fluid(voxelModel.gridSize);
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = 5.4;
    this.fluidModel.cooling   = 1.3;
    this.fluidModel.vc_eps    = 8;

    this.colourTransitionTimeCounter = 0;
    this.colourHoldTimeCounter = 0;
    this.currRandomColours = this._genRandomFireColours();
    this.nextRandomColours = this._genRandomFireColours(this.currRandomColours);

    this.t = 0;
    this.avgSpectralCentroid = 0;
    this.avgNormalizedSpectralCentroid = 0;
    this.avgRMS = 0;
    this.lastAudioFrameTime = Date.now();
    this.currAudioFrameTime = this.lastAudioFrameTime;
    this.dRMSAvg = 0;
    this.avgBeatsPerSec = 0;
    this.lastdRMS = 0;
    this.avgBeatsPerSec = 0;
    this.timeSinceLastBeat = 1;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    const {noise} = options.sceneConfig;

    const xSize = this.voxelModel.xSize();
    const ySize = this.voxelModel.ySize();
    const zSize = this.voxelModel.zSize();

    this.initArray = Randomizer.getRandomFloats(xSize*zSize);
    this.randomArray = Randomizer.getRandomFloats(xSize*zSize, 0, noise);
    //console.log(this.randomArray);

    if (!this._objectsBuilt) {

      //this.spiralIndices = AudioVisUtils.buildSpiralIndices(xSize, zSize);

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
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const {
      speedMultiplier, 
      initialIntensityMultiplier, 
      randomColourHoldTime,
      randomColourTransitionTime,
      colourMode,
      highTempColour, lowTempColour,
      colourInterpolationType
    } = this._options.sceneConfig;

    const xSize = this.voxelModel.xSize();
    const ySize = this.voxelModel.ySize();
    const zSize = this.voxelModel.zSize();

    const startX = 1;
    const endX = xSize+1;
    const startZ = 1;
    const endZ = zSize+1;
    const startY = 1;

    //const fluidTemperatures = new Array((endX-startX)*(endZ-startZ));
    //let idxCount = 0;

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        let f = this._genFunc(x-startX, z-startZ, endX-startX, endZ-startZ, this.t, this.initArray);
        const idx = this.fluidModel._I(x, startY, z);
        this.fluidModel.sd[idx] = 1.0;
        this.fluidModel.sT[idx] = (1.0 + f*initialIntensityMultiplier);
      }
    }
    /*
    // Sort the fluid model starting points by highest to lowest from the center spiraling outward
    fluidTemperatures.sort((a,b) => b-a);
    idxCount = 0;
    for (let i = 0; i < this.spiralIndices.length; i++) {
      const sIdx = this.spiralIndices[i];
      const x = sIdx[0];
      const z = sIdx[1];
      if (x >= startX && x < endX && z >= startZ && z < endZ) {
        const fIdx = this.fluidModel._I(x, startY, z);
        this.fluidModel.sT[fIdx] = fluidTemperatures[idxCount++];
      }
    }
    */
    const currSpeed = 2 + speedMultiplier * (1 + clamp(THREE.MathUtils.smootherstep(this.avgBeatsPerSec, 0, 80), 0, 0.75));
    const speedDt = dt*currSpeed;
    this.fluidModel.step(speedDt);
    this.t += speedDt;

    let fireLookupFunc = null;
    switch (colourMode) {
      case TEMPERATURE_COLOUR_MODE:
        fireLookupFunc = this._fireFuncGenTemperature();
        break;

      case RANDOM_COLOUR_MODE: {
        let finalLowTempColour  = this.currRandomColours.lowTempColour;
        let finalHighTempColour = this.currRandomColours.highTempColour;

        if (this.colourHoldTimeCounter >= randomColourHoldTime) {
          // We're transitioning between random colours, interpolate from the previous to the next
          const interpolationVal = this.colourTransitionTimeCounter/randomColourTransitionTime;
          const tempLowTempColour = chroma.mix(chroma.gl(this.currRandomColours.lowTempColour), chroma.gl(this.nextRandomColours.lowTempColour), interpolationVal, colourInterpolationType).gl();
          finalLowTempColour = new THREE.Color(tempLowTempColour[0], tempLowTempColour[1], tempLowTempColour[2]);
          const tempHighTempColour = chroma.mix(chroma.gl(this.currRandomColours.highTempColour), chroma.gl(this.nextRandomColours.highTempColour), interpolationVal, colourInterpolationType).gl();
          finalHighTempColour = new THREE.Color(tempHighTempColour[0], tempHighTempColour[1], tempHighTempColour[2]);
        
          if (this.colourTransitionTimeCounter >= randomColourTransitionTime) {
            this.currRandomColours.lowTempColour  = this.nextRandomColours.lowTempColour;
            this.currRandomColours.highTempColour = this.nextRandomColours.highTempColour;
            this.nextRandomColours = this._genRandomFireColours(this.currRandomColours);
            this.colourTransitionTimeCounter -= randomColourTransitionTime;
            this.colourHoldTimeCounter -= randomColourHoldTime;
          }
          this.colourTransitionTimeCounter += dt;
        }
        else {
          this.colourHoldTimeCounter += dt;
        }

        fireLookupFunc = this._fireFuncGenHighLow(finalHighTempColour, finalLowTempColour);
        break;
      }

      case LOW_HIGH_TEMP_COLOUR_MODE:
      default:
        fireLookupFunc = this._fireFuncGenHighLow(highTempColour, lowTempColour);
        break;
    }

    // Update the voxels and render them
    for (let x = 0; x < xSize; x++) {
      for (let y = 0; y < ySize; y++) {
        for (let z = 0; z < zSize; z++) {

          // Start by looking up the temperature and density of the flame, both are constrained in [0,1]
          const idx = this.fluidModel._I(x+startX,y+startY,z+startZ);
          const temperature = this.fluidModel.T[idx];
          const density = this.fluidModel.d[idx];
          //const lighting = 0.0;

          // Use the temp and density to look up the expected colour of the flame at the current voxel
          const temperatureIdx = Math.min(FIRE_SPECTRUM_WIDTH-1, Math.max(0, Math.round(temperature*(FIRE_SPECTRUM_WIDTH-1))));
          const densityIdx = Math.min(15, Math.max(0, Math.round(density*15)));
          const intensityIdx = 0;//Math.round(lighting*15);

          const voxelColour = fireLookupFunc(intensityIdx, densityIdx, temperatureIdx);
          const voxelMaterialColour = this.voxels[x][y][z].material.colour;
          voxelMaterialColour.setRGB(voxelColour.a*voxelColour.r, voxelColour.a*voxelColour.g, voxelColour.a*voxelColour.b);
        }
      }
    }

    this.scene.render();
  }

  updateAudioInfo(audioInfo) {
    const {gamma, levelMax} = this._options;
    const {boyancyMultiplier, coolingMultiplier, turbulenceMultiplier} = this._options.sceneConfig;
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
    this.avgNormalizedSpectralCentroid = clamp(this.avgSpectralCentroid / (fft.length / 2), 0, 1);
    const boyancyVal = clamp(this.avgNormalizedSpectralCentroid * 10, 1, 5);
    //console.log(boyancyVal);
    //console.log(this.avgNormalizedSpectralCentroid);
    //console.log(this.avgRMS);

    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = boyancyVal * boyancyMultiplier;
    this.fluidModel.cooling   = 0.1 + (1.0 - this.avgRMS) * 1.1 * coolingMultiplier; // Values range from [0.1, 2] where lower values make the fire brighter/bigger
    this.fluidModel.vc_eps = this.avgRMS * 40 * turbulenceMultiplier;

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
      const lowTempChromaHsi  = chroma(chroma.gl(currRandomColours.lowTempColour)).hsi();

      lowTempChromaHsi[0] = (lowTempChromaHsi[0] + Randomizer.getRandomInt(60,300)) % 360;
      lowTempChromaHsi[1] = Randomizer.getRandomFloat(LOW_TEMP_SATURATION[0], LOW_TEMP_SATURATION[1]);
      lowTempChromaHsi[2] = Randomizer.getRandomFloat(LOW_TEMP_INTENSITY[0], LOW_TEMP_INTENSITY[1]);

      const highTempChromaHsi = [
        (lowTempChromaHsi[0] + Randomizer.getRandomInt(HUE_DISTANCE_FROM_LOW_TEMP[0], HUE_DISTANCE_FROM_LOW_TEMP[1])) % 360, 
        1, lowTempChromaHsi[2]
      ];
      nextLowTempColour = chroma(lowTempChromaHsi, 'hsi').gl();
      nextLowTempColour = new THREE.Color(nextLowTempColour[0], nextLowTempColour[1], nextLowTempColour[2]);
      nextHighTempColour = chroma(highTempChromaHsi, 'hsi').brighten(brightenFactor).gl();
      nextHighTempColour = new THREE.Color(nextHighTempColour[0], nextHighTempColour[1], nextHighTempColour[2]);
    }
    else {
      // First time generation, pick some good random colours
      const lowTempChroma = chroma(
        Randomizer.getRandomInt(0,360),
        Randomizer.getRandomFloat(LOW_TEMP_SATURATION[0], LOW_TEMP_SATURATION[1]),
        Randomizer.getRandomFloat(LOW_TEMP_INTENSITY[0], LOW_TEMP_INTENSITY[1]), 'hsi');
      let temp = lowTempChroma.gl();
      nextLowTempColour = new THREE.Color(temp[0], temp[1], temp[2]);
      //console.log("low: " + temp);
      
      let lowTempHsi = lowTempChroma.hsi();
      //console.log("low temp Hsi: " + lowTempHsi);
      const highTempChroma = chroma((lowTempHsi[0] + 180) % 360, 1, lowTempHsi[2], 'hsi').brighten(brightenFactor);
      temp = highTempChroma.gl();
      nextHighTempColour = new THREE.Color(temp[0], temp[1], temp[2]);
      //console.log("high: " + temp);
    }

    return {
      highTempColour: nextHighTempColour,
      lowTempColour: nextLowTempColour
    };
  }

  _fireFuncGenTemperature() {
    return (intensityIdx, densityIdx, temperatureIdx) => {
      if (temperatureIdx < FIRE_THRESHOLD) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }

      const {temperatureMin, temperatureMax} = this._options.sceneConfig;

      const intensityCoeff = THREE.MathUtils.smoothstep(intensityIdx, 0, 15);
      const densityCoeff   = THREE.MathUtils.smoothstep(densityIdx, 0, 15);
      const brightenAmt    = intensityCoeff * 2;
      const desaturateAmt  = densityCoeff * 2;

      const temperatureNorm = temperatureIdx / (FIRE_SPECTRUM_WIDTH - 1);
      const temperature = THREE.MathUtils.lerp(temperatureMin, temperatureMax, temperatureNorm) + 
        100 * brightenAmt - 100 * desaturateAmt;
      const finalColour = chroma.temperature(temperature).gl();

      return {
        r: finalColour[0],
        g: finalColour[1],
        b: finalColour[2],
        a: this._fireAlpha(temperatureIdx)
      };
    };
  }

  _fireFuncGenHighLow(highTempColour, lowTempColour) {
    return (intensityIdx, densityIdx, temperatureIdx) => {
      if (temperatureIdx < FIRE_THRESHOLD) {
        return {r: 0, g:0, b:0, a:0};
      }
  
      const {colourInterpolationType} = this._options.sceneConfig;
      const intensityCoeff = THREE.MathUtils.smoothstep(intensityIdx, 0, 15);
      const densityCoeff = THREE.MathUtils.smoothstep(densityIdx, 0, 15);

      const brightenAmt = intensityCoeff*2;
      const desaturateAmt = densityCoeff*2;

      const lowTempColourWithAlpha  = { r: lowTempColour.r,  g: lowTempColour.g,  b: lowTempColour.b,  a: 1 };
      const highTempColourWithAlpha = { r: highTempColour.r, g: highTempColour.g, b: highTempColour.b, a: 1 };

      const finalColour = chroma.mix(
        chroma.gl(lowTempColourWithAlpha), chroma.gl(highTempColourWithAlpha), 
        temperatureIdx / (FIRE_SPECTRUM_WIDTH - 1), colourInterpolationType
      ).brighten(brightenAmt).desaturate(desaturateAmt).gl();

      return {
        r: finalColour[0],
        g: finalColour[1],
        b: finalColour[2],
        a: this._fireAlpha(temperatureIdx)
      };
    }
  }

  _fireAlpha(temperatureIdx) {
    return MAX_FIRE_ALPHA * ((temperatureIdx > FULL_ON_FIRE) ? 1.0 : 
      (temperatureIdx-FIRE_THRESHOLD) / (FULL_ON_FIRE-FIRE_THRESHOLD));
  }

  _genFunc(x, y, sx, sy, t, p) {
    const {noise} = this._options.sceneConfig;
    let avgP = 0;
    let maxP = 0;
    for (let j = 0; j < p.length; j++) {
      avgP += p[j];
      maxP = Math.max(maxP, p[j]);
    }
    avgP /= p.length;

    const multiplier = Math.max(avgP, noise/4);

    let f = 0;
    let i = 0;
    
    let pIdx = 0;
    const calcP = () => {
      const result = p[pIdx] + this.randomArray[pIdx];
      pIdx = (pIdx + 1) % p.length;
      return clamp(result, 0, 1);
    };

    for (; i < 12; i++) {
      f += (1.0 +
        Math.sin(x/sx*PI2*(calcP()+1)+(calcP())*PI2 + (calcP())*t) *
        Math.sin(y/sy*PI2*(calcP()+1)+(calcP())*PI2 + (calcP())*t)) *
        (1 + Math.sin((calcP()+0.5)*t + (calcP())*PI2)) * multiplier;
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