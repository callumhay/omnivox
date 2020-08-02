import VoxelAnimator from "./VoxelAnimator";
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';

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

  static buildSpiralIndices(xSize, ySize) {
    const allIndices = {};
    for (let x = 0; x < xSize; x++) {
      for (let y = 0; y < ySize; y++) {
        allIndices[x+"_"+y] = true;
      }
    }

    let r = 1;

    const gridSize = xSize*ySize;
    const startX = Math.floor(xSize/2);
    const startY = Math.floor(ySize/2);
    const result = [];

    while (result.length < gridSize) {
      const rSqr = r*r;
      for (let x = 0; x < xSize; x++) {
        for (let y = 0; y < ySize; y++) {
          const idx = x+"_"+y;
          if (allIndices[idx]) {
            let xDiff = x - startX;
            let yDiff = y - startY;
            if (xDiff*xDiff + yDiff*yDiff <= rSqr) {
              result.push([x,y]);
              allIndices[idx] = false;
            }
          }
        }
      }
      r++;
    }
    
    return result;
  }
}

export default AudioVisualizerAnimator;