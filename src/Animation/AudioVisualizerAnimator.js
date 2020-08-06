import * as THREE from 'three';
import chroma from 'chroma-js';

import VoxelAnimator from "./VoxelAnimator";
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';

import Spectrum from '../Spectrum';
import {clamp} from '../MathUtils';

const MAX_AVG_BEATS_PER_SEC = 120;

class AudioVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, config={...soundVisDefaultConfig}) {
    super(voxelModel, config);
  }

  setAudioInfo(audioInfo) {
    const {rms} = audioInfo;

    this.currAudioFrameTime = Date.now();
    this.dtAudioFrame=  Math.max(0.000001, (this.currAudioFrameTime - this.lastAudioFrameTime) / 1000);
    this.lastAudioFrameTime = this.currAudioFrameTime;

    const denoisedRMS = rms < 0.01 ? 0 : rms;
    this.avgRMS = (this.avgRMS + denoisedRMS) / 2.0;

    this.dRMSAvg = (this.dRMSAvg + (denoisedRMS - this.lastRMS) / this.dtAudioFrame) / 2.0;
    if (this.timeSinceLastBeat > 0.001 && (this.dRMSAvg < 0 && this.lastdRMS > 0) || (this.dRMSAvg > 0 && this.lastdRMS < 0)) {
      // We crossed zero, count the beat
      this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 1.0 / this.timeSinceLastBeat) / 2.0, 0, MAX_AVG_BEATS_PER_SEC);
      this.timeSinceLastBeat = 0;
    }
    else {
      this.timeSinceLastBeat += this.dtAudioFrame;
      if (this.timeSinceLastBeat > 1) {
        this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 0.01) / 2.0, 0, MAX_AVG_BEATS_PER_SEC);
      }
    }
    
    this.lastRMS  = denoisedRMS;
    this.lastdRMS = this.dRMSAvg;
  }

  reset() {
    super.reset();

    this.avgRMS = 0;
    this.dtAudioFrame = 0;
    this.lastAudioFrameTime = Date.now();
    this.currAudioFrameTime = this.lastAudioFrameTime;
    this.dRMSAvg = 0;
    this.avgBeatsPerSec = 0;
    this.lastdRMS = 0;
    this.lastRMS = 0;
    this.avgBeatsPerSec = 0;
    this.timeSinceLastBeat = 1;
  }

  static buildBinIndexLookup(numFreqs, numBins, gamma) {
    const binIndexLookup = {};
    for (let i = 0; i < numFreqs; i++) {
      let binIndex = Math.round(Math.pow(i/numFreqs, 1.0/gamma) * (numBins-1));
      if (binIndex in binIndexLookup) {
        binIndexLookup[binIndex].push(i);
      }
      else {
        binIndexLookup[binIndex] = [i];
      }
    }

    // Find gaps in the lookup and just have those gaps reference the previous (or next) bin's frequency(ies)
    for (let i = 0; i < numBins; i++) {
      if (i in binIndexLookup) {
        continue;
      }

      // Is there a previous bin?
      if (i-1 in binIndexLookup) {
        binIndexLookup[i] = binIndexLookup[i-1];
      }
      // Is there a next bin?
      else if (i+1 in binIndexLookup) {
        binIndexLookup[i] = binIndexLookup[i+1];
      }
      else {
        // This really shouldn't happen, it means there's a huge gap
        console.error("Big gap in the number of frequencies to available bins, please find me and write code to fix this issue.");
      }
    }

    return binIndexLookup;
  }

  static calcFFTBinLevelSum(binIndices, fft) {
    let binLevel = 0;
    for (let i = 0; i < binIndices.length; i++) {
      binLevel += fft[binIndices[i]];
    }
    return binLevel;
  }
  static calcFFTBinLevelMax(binIndices, fft) {
    let binLevel = 0;
    for (let i = 0; i < binIndices.length; i++) {
      binLevel = Math.max(binLevel, fft[binIndices[i]]);
    }
    return binLevel;
  }
}

export default AudioVisualizerAnimator;

export class RandomHighLowColourCycler {
  constructor(config=RandomHighLowColourCycler.randomColourCyclerDefaultConfig) {
    this.reset();
    this.setConfig(config);
  }

  static get randomColourCyclerDefaultConfig() {
    return {
      randomColourHoldTime: 5,
      randomColourTransitionTime: 2,
    };
  }

  setConfig(c) {
    this.config = c;
  }
  reset() {
    this.colourTransitionTimeCounter = 0;
    this.colourHoldTimeCounter = 0;
    this.currRandomColours = Spectrum.genRandomHighLowColours();
    this.nextRandomColours = Spectrum.genRandomHighLowColours(this.currRandomColours);
  }

  isTransitioning() {
    const {randomColourHoldTime} = this.config;
    return this.colourHoldTimeCounter >= randomColourHoldTime;
  }

  tick(dt, colourInterpolationType) {
    const {randomColourTransitionTime} = this.config;

    if (this.isTransitioning()) {
      // We're transitioning between random colours, interpolate from the previous to the next
      const interpolationVal = clamp(this.colourTransitionTimeCounter / randomColourTransitionTime, 0, 1);

      const {lowTempColour:currLowTC, highTempColour:currHighTC} = this.currRandomColours;
      const {lowTempColour:nextLowTC, highTempColour:nextHighTC} = this.nextRandomColours;

      const tempLowTempColour = chroma.mix(chroma.gl([currLowTC.r, currLowTC.g, currLowTC.b, 1]), chroma.gl([nextLowTC.r, nextLowTC.g, nextLowTC.b, 1]), interpolationVal, colourInterpolationType).gl();
      const tempHighTempColour = chroma.mix(chroma.gl([currHighTC.r, currHighTC.g, currHighTC.b, 1]), chroma.gl([nextHighTC.r, nextHighTC.g, nextHighTC.b, 1]), interpolationVal, colourInterpolationType).gl();
      
      const finalLowTempColour = new THREE.Color(tempLowTempColour[0], tempLowTempColour[1], tempLowTempColour[2]);
      const finalHighTempColour = new THREE.Color(tempHighTempColour[0], tempHighTempColour[1], tempHighTempColour[2]);

      this.colourTransitionTimeCounter += dt;
      if (this.colourTransitionTimeCounter >= randomColourTransitionTime) {
        this.currRandomColours = {lowTempColour: finalLowTempColour, highTempColour: finalHighTempColour};
        this.nextRandomColours = Spectrum.genRandomHighLowColours(this.currRandomColours);
        this.colourTransitionTimeCounter = 0;
        this.colourHoldTimeCounter = 0;
      }

      return {
        lowTempColour: finalLowTempColour,
        highTempColour: finalHighTempColour
      };
    }
    else {
      this.colourHoldTimeCounter += dt;
    }

    return this.currRandomColours;
  }
}