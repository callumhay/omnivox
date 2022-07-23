import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import AudioVisualizerAnimator from './AudioVisualizerAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';

import {RandomHighLowColourCycler} from '../Randomizers';
import Spectrum, {COLOUR_INTERPOLATION_LRGB} from '../Spectrum';

const STATIC_BARS_DISPLAY_TYPE         = "Static";
const MOVING_HISTORY_BARS_DISPLAY_TYPE = "Moving History";
const DISPLAY_MODE_TYPES = [
  STATIC_BARS_DISPLAY_TYPE,
  MOVING_HISTORY_BARS_DISPLAY_TYPE,
];

const POS_X_DIR = "+x";
const NEG_X_DIR = "-x";
const POS_Z_DIR = "+z";
const NEG_Z_DIR = "-z";
const DIRECTION_TYPES = [POS_X_DIR, NEG_X_DIR, POS_Z_DIR, NEG_Z_DIR];

const LOW_HIGH_COLOUR_MODE = "Low High Colour";
const RANDOM_COLOUR_MODE = "Random";
const COLOUR_MODES = [
  LOW_HIGH_COLOUR_MODE, 
  RANDOM_COLOUR_MODE,
];

export const barVisualizerAnimatorDefaultConfig = {
  ...soundVisDefaultConfig,

  colourMode: LOW_HIGH_COLOUR_MODE,
  // Low/High colour mode (static)
  lowColour:   {r: 0.6, g: 0.988, b: 0.125},
  highColour:  {r: 0.992, g: 0.098, b: 0.6},
  // Random colour mode
  ...RandomHighLowColourCycler.randomColourCyclerDefaultConfig,
  
  colourInterpolationType: COLOUR_INTERPOLATION_LRGB,
  
  displayMode: STATIC_BARS_DISPLAY_TYPE,

  // Static bar display options
  centerSorted: false,
  splitLevels:  false,

  // History bar display options
  speed:           10,
  tempoMultiplier: 15,
  direction:       NEG_Z_DIR,
};

class BarVisualizerAnimator extends AudioVisualizerAnimator {
  static get STATIC_BARS_DISPLAY_TYPE() { return STATIC_BARS_DISPLAY_TYPE; }
  static get MOVING_HISTORY_BARS_DISPLAY_TYPE() { return MOVING_HISTORY_BARS_DISPLAY_TYPE; }
  static get DISPLAY_MODE_TYPES() { return DISPLAY_MODE_TYPES; }
  static get DIRECTION_TYPES() { return DIRECTION_TYPES; }
  static get LOW_HIGH_COLOUR_MODE() { return LOW_HIGH_COLOUR_MODE; }
  static get RANDOM_COLOUR_MODE() { return RANDOM_COLOUR_MODE; }
  static get COLOUR_MODES() { return COLOUR_MODES; }

  constructor(voxelModel, config=barVisualizerAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER; }

  load() {
    super.load();
    const {gridSize, gpuKernelMgr} = this.voxelModel;

    const halfGridSize = (gridSize/2);
    // This should always be a square number! We use this number to make the bars into 2x2 columns within the grid
    const STATIC_INTENSITY_ARRAY_SIZE = Math.max(64, halfGridSize*halfGridSize);

    this.randomColourCycler = new RandomHighLowColourCycler();
    this.audioIntensities = new Array(STATIC_INTENSITY_ARRAY_SIZE).fill(0);
    this.audioHistoryBuffer = new Array(gridSize).fill(null);
    for (let i = 0; i < gridSize; i++) {
      this.audioHistoryBuffer[i] = new Array(gridSize).fill(0);
    }

    // Build the GPU kernels for rendering the various configurations of the bar visualizer
    gpuKernelMgr.initBarVisualizerKernels(gridSize, STATIC_INTENSITY_ARRAY_SIZE);
    if (!this.prevVisTex) {
      this.prevVisTex = gpuKernelMgr.initBarVisualizerBuffer4Func(0,0,0,0);
    }

    this.timeCounter = 0;
    this.updateGamma = true;
  }
  unload() {
    super.unload();
    this.randomColourCycler = null;
    this.audioIntensities = null;
    this.audioHistoryBuffer = null;
    this.levelColours = null;
    if (this.prevVisTex) {
      this.prevVisTex.delete();
      this.prevVisTex = null;
    }
    this.binIndexLookup = null;
    this.updateGamma = false;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; }

    const {
      displayMode, lowColour, highColour, colourInterpolationType, 
      direction, randomColourHoldTime, randomColourTransitionTime
    } = this.config;

    this.randomColourCycler.setConfig({randomColourHoldTime, randomColourTransitionTime});

    switch (displayMode) {
      case MOVING_HISTORY_BARS_DISPLAY_TYPE:
        switch (direction) {
          case POS_X_DIR: this.directionVec = [1, 0]; break;
          case NEG_X_DIR: this.directionVec = [-1,0]; break;
          case POS_Z_DIR: this.directionVec = [0, 1]; break;
          default:
          case NEG_Z_DIR: this.directionVec = [0,-1]; break;
        }
        break;
      default:
        break;
    }
    // Set the level colours to low/high to initialize the array, this may be updated/changed in render() depending on the colour mode
    this.levelColours = Spectrum.genLowToHighColourSpectrum(lowColour, highColour, colourInterpolationType, this._numLevelColours());
    this.updateGamma = true;
  }

  reset() {
    super.reset();
    this.timeCounter = 0;
    if (this.randomColourCycler) { this.randomColourCycler.reset(); }
  }

  render(dt) {
    const {displayMode, levelMax, fadeFactor, colourMode} = this.config;
    const {gpuKernelMgr, framebuffer} = this.voxelModel;
    
    switch (colourMode) {
      case RANDOM_COLOUR_MODE: {
        // In random colour mode we're animating the colour over time, check to see if it has changed and update it accordingly
        const {colourInterpolationType} = this.config;
        const currColours = this.randomColourCycler.tick(dt, colourInterpolationType);
        Spectrum.getLowToHighColourSpectrum(this.levelColours, currColours.lowTempColour, currColours.highTempColour, colourInterpolationType);
        break;
      }
      default: break;
    }

    const temp = this.prevVisTex;
    switch (displayMode) {
      case MOVING_HISTORY_BARS_DISPLAY_TYPE:
        this.prevVisTex = gpuKernelMgr.historyBarVisFunc(
          this.audioHistoryBuffer, this.directionVec, levelMax, fadeFactor, this.levelColours, this.prevVisTex, dt
        );
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
    if (temp !== this.prevVisTex) { temp.delete(); }
    
    framebuffer.setBufferTexture(gpuKernelMgr.renderBarVisualizerAlphaFunc(this.prevVisTex));
  }

  setAudioInfo(audioInfo) {
    super.setAudioInfo(audioInfo);

    const {fft} = audioInfo;
    const {gamma, centerSorted, displayMode} = this.config;

    const numIntensities = displayMode === MOVING_HISTORY_BARS_DISPLAY_TYPE ? this.voxelModel.gridSize : this.audioIntensities.length;

    // Build a distribution of what bins to throw each frequency in
    if (!this.binIndexLookup || this.updateGamma) {
      this.binIndexLookup = AudioVisualizerAnimator.buildBinIndexLookup(fft.length, numIntensities, gamma);
      this.updateGamma = false;
    }

    switch (displayMode) {
      case MOVING_HISTORY_BARS_DISPLAY_TYPE: {
        const {speed, tempoMultiplier} = this.config;
        const tempoBeat = THREE.MathUtils.smootherstep(Math.min(1, this.avgRMS), 0, 1)*tempoMultiplier;
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
          const binLookup = this.binIndexLookup[key];
          this.audioIntensities[index] = AudioVisualizerAnimator.calcFFTBinLevelMax(binLookup, fft);
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

  _numLevelColours() {
    const {splitLevels} = this.config;
    const ySize = this.voxelModel.ySize();
    return splitLevels ? Math.floor(ySize/2) : ySize;
  }
};

export default BarVisualizerAnimator;
