import VoxelAnimator from "./VoxelAnimator";
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';

const RMS_BUFFER_SIZE = 3;
const MIN_MAX_RMS = 0.1;

const ZCR_BUFFER_SIZE = 3;
const MIN_MAX_ZCR = 50;

const MAX_RESET_WINDOW_TIME_S = 3;
const DIMINISH_WEIGHT = 0.8;
const ONEM_DIMINISH_WEIGHT = (1-DIMINISH_WEIGHT);

class AudioVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, config={...soundVisDefaultConfig}) {
    super(voxelModel, config);
  }

  setAudioInfo(audioInfo) {
    const currAudioFrameTime = Date.now();
    this.dtAudioFrame = Math.max(0.000001, (currAudioFrameTime - this.lastAudioFrameTime) / 1000);
    this.lastAudioFrameTime = currAudioFrameTime;

    const {rms, zcr} = audioInfo;

    this.rmsBuffer.shift();
    this.rmsBuffer.push(rms);
    this.avgRMS = (this.rmsBuffer.reduce((a,b) => a+b, 0) / Math.max(1,this.rmsBuffer.length)) || 0;

    this.zcrBuffer.shift();
    this.zcrBuffer.push(zcr);
    this.avgZCR = (this.zcrBuffer.reduce((a,b) => a+b, 0) / Math.max(1,this.zcrBuffer.length)) || 0;

    // Reset the maximum values within a window to avoid making the max too high
    // i.e., accomodate if a new song plays or the mic is moved or the levels change etc.
    if (this.currMaxResetTimeCounter >= MAX_RESET_WINDOW_TIME_S) {
      this.currMaxRMS = Math.max(MIN_MAX_RMS, this.currMaxRMS*DIMINISH_WEIGHT + this.avgRMS*ONEM_DIMINISH_WEIGHT);
      this.currMaxZCR = Math.max(MIN_MAX_ZCR, this.currMaxZCR*DIMINISH_WEIGHT + this.avgZCR*ONEM_DIMINISH_WEIGHT);
      
      this.currMaxResetTimeCounter = 0;
    }
    else {
      this.currMaxRMS = Math.max(MIN_MAX_RMS, this.currMaxRMS*DIMINISH_WEIGHT + Math.max(this.avgRMS, this.currMaxRMS)*ONEM_DIMINISH_WEIGHT);
      this.currMaxZCR = Math.max(MIN_MAX_ZCR, this.currMaxZCR*DIMINISH_WEIGHT + Math.max(this.avgZCR, this.currMaxZCR)*ONEM_DIMINISH_WEIGHT);

      this.currMaxResetTimeCounter += this.dtAudioFrame;
    }

  }

  reset() {
    super.reset();

    this.currMaxResetTimeCounter = 0;

    this.rmsBuffer = Array(RMS_BUFFER_SIZE).fill(0);
    this.avgRMS = 0;
    this.currMaxRMS = MIN_MAX_RMS;

    this.zcrBuffer = Array(ZCR_BUFFER_SIZE).fill(0);
    this.avgZCR = 0;
    this.currMaxZCR = MIN_MAX_ZCR;

    this.dtAudioFrame = 0;
    this.lastAudioFrameTime = Date.now();
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