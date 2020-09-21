import * as THREE from 'three';
import chroma from 'chroma-js';

import AudioVisualizerAnimator, {RandomHighLowColourCycler} from './AudioVisualizerAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';

import Spectrum, {COLOUR_INTERPOLATION_RGB} from '../Spectrum';
import {clamp} from '../MathUtils';

const STATIC_BARS_DISPLAY_TYPE         = "Static";
const MOVING_HISTORY_BARS_DISPLAY_TYPE = "Moving History";

const POS_X_DIR = "+x";
const NEG_X_DIR = "-x";
const POS_Z_DIR = "+z";
const NEG_Z_DIR = "-z";

const LOW_HIGH_COLOUR_MODE = "Low/High Colour";
const RANDOM_COLOUR_MODE = "Random";

export const barVisualizerAnimatorDefaultConfig = {
  ...soundVisDefaultConfig,

  colourMode: LOW_HIGH_COLOUR_MODE,
  // Low/High colour mode (static)
  lowColour:   new THREE.Color("#99FC20"),
  highColour:  new THREE.Color("#FD1999"),
  // Random colour mode
  ...RandomHighLowColourCycler.randomColourCyclerDefaultConfig,
  
  colourInterpolationType: COLOUR_INTERPOLATION_RGB,
  

  displayMode: STATIC_BARS_DISPLAY_TYPE,

  // Static bar display options
  centerSorted: false,
  splitLevels:  false,

  // History bar display options
  speed:           5.0,
  tempoMultiplier: 15.0,
  direction:       NEG_Z_DIR,
};

class BarVisualizerAnimator extends AudioVisualizerAnimator {
  static get STATIC_BARS_DISPLAY_TYPE() { return STATIC_BARS_DISPLAY_TYPE; }
  static get MOVING_HISTORY_BARS_DISPLAY_TYPE() { return MOVING_HISTORY_BARS_DISPLAY_TYPE; }
  static get DISPLAY_MODE_TYPES() {
    return [
      STATIC_BARS_DISPLAY_TYPE,
      MOVING_HISTORY_BARS_DISPLAY_TYPE,
    ];
  }

  static get DIRECTION_TYPES() {
    return [POS_X_DIR, NEG_X_DIR, POS_Z_DIR, NEG_Z_DIR];
  }

  static get LOW_HIGH_COLOUR_MODE() { return LOW_HIGH_COLOUR_MODE; }
  static get RANDOM_COLOUR_MODE() { return RANDOM_COLOUR_MODE; }
  static get COLOUR_MODES() {
    return [
      LOW_HIGH_COLOUR_MODE,
      RANDOM_COLOUR_MODE,
    ];
  }

  constructor(voxelModel, config=barVisualizerAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER; }

  setConfig(c) {
    super.setConfig(c);
    const {displayMode, colourMode, colourInterpolationType, direction, randomColourHoldTime, randomColourTransitionTime} = c;
    const {gridSize, gpuKernelMgr} = this.voxelModel;

    if (!this.randomColourCycler) {
      this.randomColourCycler = new RandomHighLowColourCycler();
    }
    this.randomColourCycler.setConfig({randomColourHoldTime, randomColourTransitionTime});

    const halfGridSize = (gridSize/2);
    const STATIC_INTENSITY_ARRAY_SIZE = Math.max(64, halfGridSize*halfGridSize); // This should always be a square number! We use these number to make the bars into 2x2 columns within the grid

    switch (displayMode) {
      case MOVING_HISTORY_BARS_DISPLAY_TYPE:
        this.audioHistoryBuffer = new Array(gridSize).fill(null);
        for (let i = 0; i < gridSize; i++) {
          this.audioHistoryBuffer[i] = new Array(gridSize).fill(0);
        }
        switch (direction) {
          case POS_X_DIR:
            this.directionVec = [1,0];
            break;
          case NEG_X_DIR:
            this.directionVec = [-1,0];
            break;
          case POS_Z_DIR:
            this.directionVec = [0,1];
            break;
          case NEG_Z_DIR:
          default:
            this.directionVec = [0,-1];
            break;
        }
        break;

      case STATIC_BARS_DISPLAY_TYPE:
      default:
        this.audioIntensities = new Array(STATIC_INTENSITY_ARRAY_SIZE).fill(0);
        break;
    }

    switch (colourMode) {
      case LOW_HIGH_COLOUR_MODE:
      default:
        const {lowColour, highColour} = c;
        this.levelColours = Spectrum.genLowToHighColourSpectrum(lowColour, highColour, colourInterpolationType, this._numLevelColours());
        break;
      case RANDOM_COLOUR_MODE:
        const {lowTempColour, highTempColour} = this.randomColourCycler.currRandomColours;
        this.levelColours = Spectrum.genLowToHighColourSpectrum(lowTempColour, highTempColour, colourInterpolationType, this._numLevelColours());
        break;
    }

    // Build the GPU kernels for rendering the various configurations of the bar visualizer
    gpuKernelMgr.initBarVisualizerKernels(gridSize, STATIC_INTENSITY_ARRAY_SIZE);
    if (!this.prevVisTex) {
      this.prevVisTex = gpuKernelMgr.initBarVisualizerBuffer3Func(0,0,0,0);
    }
  }

  _numLevelColours() {
    const {splitLevels} = this.config;
    const ySize = this.voxelModel.ySize();
    return splitLevels ? Math.floor(ySize/2) : ySize;
  }

  reset() {
    super.reset();
    this.timeCounter = 0;
    this.randomColourCycler.reset();
  }

  render(dt) {
    const {displayMode, levelMax, fadeFactor, colourMode} = this.config;
    const {gpuKernelMgr, framebuffer} = this.voxelModel;

    // In random colour mode we're animating the colour over time, check to see if it has changed and update it accordingly
    if (colourMode === RANDOM_COLOUR_MODE) {
      const {colourInterpolationType} = this.config;
      const currColours = this.randomColourCycler.tick(dt, colourInterpolationType);
      if (this.randomColourCycler.isTransitioning()) {
        this.levelColours = Spectrum.genLowToHighColourSpectrum(currColours.lowTempColour, currColours.highTempColour, colourInterpolationType, this._numLevelColours());
      }
    }

    let temp = this.prevVisTex;
    switch (displayMode) {
      case MOVING_HISTORY_BARS_DISPLAY_TYPE:
        this.prevVisTex = gpuKernelMgr.historyBarVisFunc(this.audioHistoryBuffer, this.directionVec, levelMax, fadeFactor, this.levelColours, this.prevVisTex, dt);
        break;

      case STATIC_BARS_DISPLAY_TYPE:
      default:
        const {centerSorted, splitLevels} = this.config;
        if (centerSorted) {
          const barFunc = splitLevels ? gpuKernelMgr.staticCenteredSplitLevelBarVisFunc : gpuKernelMgr.staticCenteredBarVisFunc;
          this.prevVisTex = barFunc(this.audioIntensities, levelMax, fadeFactor, this.levelColours, this.prevVisTex, dt);
        }
        else {
          const barFunc = splitLevels ? gpuKernelMgr.staticSplitLevelBarVisFunc : gpuKernelMgr.staticBarVisFunc;
          this.prevVisTex = barFunc(this.audioIntensities, levelMax, fadeFactor, this.levelColours, this.prevVisTex, dt);
        }
        break;
    }
    temp.delete();

    framebuffer.setBufferTexture(gpuKernelMgr.renderBarVisualizerAlphaFunc(this.prevVisTex));
  }

  setAudioInfo(audioInfo) {
    super.setAudioInfo(audioInfo);

    const {fft} = audioInfo;
    const {gamma, centerSorted, displayMode} = this.config;

    const numIntensities = displayMode === MOVING_HISTORY_BARS_DISPLAY_TYPE ? this.voxelModel.gridSize : this.audioIntensities.length;

    // Build a distribution of what bins to throw each frequency in
    const numFreqs = Math.floor(fft.length/(gamma+1.8));
    if (!this.binIndexLookup || numFreqs !== this.binIndexLookup.length) {
      this.binIndexLookup = AudioVisualizerAnimator.buildBinIndexLookup(numFreqs, numIntensities, gamma);
    }

    switch (displayMode) {
      case MOVING_HISTORY_BARS_DISPLAY_TYPE: {
        const {speed, tempoMultiplier} = this.config;
        const tempoBeat = clamp(THREE.MathUtils.smootherstep(this.avgBeatsPerSec, 0, 80), 0, 1)*tempoMultiplier;
        const oneOverSpeed = 1.0 / Math.max(1, speed + tempoBeat);
    
        if (this.timeCounter >= oneOverSpeed) {
          // Create the next audio frame from the FFT data
          const newAudioFrame = new Array(numIntensities);
          for (let i = 0; i < numIntensities; i++) {
            const fftIndices = this.binIndexLookup[i];
            newAudioFrame[i] = AudioVisualizerAnimator.calcFFTBinLevelMax(fftIndices, fft);
          }
          const numFrames = Math.min(this.audioHistoryBuffer.length, Math.floor(this.timeCounter/oneOverSpeed));
          for (let i = 0; i < numFrames; i++) {
            this.audioHistoryBuffer.pop();
            this.audioHistoryBuffer.unshift(newAudioFrame);
          }
          this.timeCounter -= numFrames * oneOverSpeed;
        }
        else {
          for (let i = 0; i < numIntensities; i++) {
            const fftIndices = this.binIndexLookup[i];
            this.audioHistoryBuffer[0][i] = (AudioVisualizerAnimator.calcFFTBinLevelMax(fftIndices, fft) + this.audioHistoryBuffer[0][i])/2;
          }
          this.timeCounter += this.dtAudioFrame;
        }
        break;
      }

      case STATIC_BARS_DISPLAY_TYPE:
      default: {
        // Throw the audio levels of the distribution into the proper bins
        Object.keys(this.binIndexLookup).forEach((key, index) => {
          this.audioIntensities[index] = AudioVisualizerAnimator.calcFFTBinLevelSum(this.binIndexLookup[key], fft);
        });
        if (centerSorted) {
          // If the display is center sorted, then we place the highest intensity frequencies in the center of the base of the voxel grid, 
          // then move outwards with the lower ones: Sort all of the frequency bins by their descending intensities.
          this.audioIntensities.sort((a,b) => b-a);
        }
        break;
      }
    } 
  }

};

export default BarVisualizerAnimator;