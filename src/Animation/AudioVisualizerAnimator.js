import VoxelAnimator from "./VoxelAnimator";
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';
import VoxelConstants from "../VoxelConstants";

const BUFFER_LEN_IN_SECS = 2;

const RMS_BUFFER_SIZE = VoxelConstants.NUM_AUDIO_SAMPLES_PER_SEC*BUFFER_LEN_IN_SECS;
const MIN_MAX_RMS = 0.1;

const ZCR_BUFFER_SIZE = VoxelConstants.NUM_AUDIO_SAMPLES_PER_SEC*BUFFER_LEN_IN_SECS;
const MIN_MAX_ZCR = 50;

const DIMINISH_WEIGHT = 0.5;
const ONEM_DIMINISH_WEIGHT = (1-DIMINISH_WEIGHT);

class AudioVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, config={...soundVisDefaultConfig}) {
    super(voxelModel, config);
  }

  _reinitAudioParams() {
    this.currMaxResetTimeCounter = 0;

    this.rmsBuffer = [];
    this.avgRMS = 0;
    this.lastRMSSum = 0;
    this.currMaxRMS = MIN_MAX_RMS;

    this.zcrBuffer = [];
    this.avgZCR = 0;
    this.lastZCRSum = 0;
    this.currMaxZCR = MIN_MAX_ZCR;

    this.dtAudioFrame = 0;
    this.lastAudioFrameTime = Date.now();
  }

  load() {
    this._reinitAudioParams();
  }
  unload() {
    this.rmsBuffer = null;
    this.zcrBuffer = null;
  }

  reset() {
    this._reinitAudioParams();
  }

  setAudioInfo(audioInfo) {
    const currAudioFrameTime = Date.now();
    this.dtAudioFrame = Math.max(0.000001, (currAudioFrameTime - this.lastAudioFrameTime) / 1000);
    this.lastAudioFrameTime = currAudioFrameTime;

    const {rms, zcr} = audioInfo;

    if (this.rmsBuffer.length === RMS_BUFFER_SIZE) { 
      const rmsVal = this.rmsBuffer.shift();
      this.lastRMSSum -= rmsVal;
    }
    this.rmsBuffer.push(rms);
    this.lastRMSSum += rms;
    this.avgRMS = this.lastRMSSum / Math.max(1,this.rmsBuffer.length);
    
    if (this.zcrBuffer.length === ZCR_BUFFER_SIZE) {
      const zcrVal = this.zcrBuffer.shift();
      this.lastZCRSum -= zcrVal;
    }
    this.zcrBuffer.push(zcr);
    this.lastZCRSum += zcr;
    this.avgZCR = this.lastZCRSum / Math.max(1,this.zcrBuffer.length);

    const currBufMaxRMS = Math.max(...this.rmsBuffer);
    const currBufMaxZCR = Math.max(...this.zcrBuffer);
    this.currMaxRMS = Math.max(MIN_MAX_RMS, this.currMaxRMS*DIMINISH_WEIGHT + currBufMaxRMS*ONEM_DIMINISH_WEIGHT);
    this.currMaxZCR = Math.max(MIN_MAX_ZCR, this.currMaxZCR*DIMINISH_WEIGHT + currBufMaxZCR*ONEM_DIMINISH_WEIGHT);
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
      if (i in binIndexLookup) { continue; }
      if (i-1 in binIndexLookup) { binIndexLookup[i] = binIndexLookup[i-1]; }      // Is there a previous bin? 
      else if (i+1 in binIndexLookup) { binIndexLookup[i] = binIndexLookup[i+1]; } // Is there a next bin?
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