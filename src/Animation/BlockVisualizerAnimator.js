import chroma from 'chroma-js';
import * as THREE from 'three';

import {SCRIABIN_NOTE_COLOURS} from '../Spectrum';
import VoxelConstants from '../VoxelConstants';

import VoxelAnimator from './VoxelAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';
import AudioVisualizerAnimator from "./AudioVisualizerAnimator";

export const blockVisualizerAnimatorDefaultConfig = {
  ...soundVisDefaultConfig,
  blockSize: 'dynamic',
  dynamicBlockSizeTransitionTimeSecs: 1,
  shuffleBlocks: true,
  fadeFactor: 0.03,
  blurIntensitySpeed: 75,
  brightenIntensity: 1.5,
};

const MIN_BLOCK_SIZE = 2;
const MAX_NUM_BLOCKS = Math.pow(VoxelConstants.VOXEL_GRID_SIZE / MIN_BLOCK_SIZE, 3);
const _tempAudioIntensities = new Array(MAX_NUM_BLOCKS).fill(0);

const NUM_LUM_LEVELS = 32;
const NUM_LUM_LEVELS_MINUS1 = NUM_LUM_LEVELS-1;
const _tempColour = new THREE.Color();

class BlockVisualizerAnimator extends AudioVisualizerAnimator {
  constructor(voxelModel, config=blockVisualizerAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_BLOCK_VISUALIZER; }

  load() {
    super.load();
    const {gridSize, gpuKernelMgr} = this.voxelModel;
    gpuKernelMgr.initBlockVisualizerKernels(gridSize, NUM_LUM_LEVELS);
    if (!this.prevVisTex) {
      this.prevVisTex = gpuKernelMgr.initBlockVisualizerBuffer4Func(0,0,0,0);
    }
    this.currColour = new THREE.Color();
    
    this.currColourLums = new Array(NUM_LUM_LEVELS).fill(null);
    for (let i = 0; i < NUM_LUM_LEVELS; i++) { this.currColourLums[i] = [0,0,0]; }
    this.timeSinceLastBlockSizeTransition = Infinity;
  }
  unload() {
    super.unload();
    this.binIndexLookup = null;
    this.audioIntensities = null;
    this.shuffleLookup = null;
    this.prevVisTex.delete();
    this.prevVisTex = null;
    this.currColour = null;
    this.currColourLums = null;
    this.updateGamma = true;
  }

  setConfig(c, init=false) {
    const initialConfig = this.config;
    if (!super.setConfig(c, init)) { return; }

    // Reset the bin index lookup if the block size changed
    if (this.config.blockSize === 'dynamic') {
      this.config.dynamicBlockSize = true;
      this.config.blockSize = 2;
    }
    else {
      this.config.dynamicBlockSize = false;
      this.config.blockSize = parseInt(this.config.blockSize);
    }

    const {blockSize, gamma} = this.config;
    if (!this.audioIntensities || blockSize !== parseInt(initialConfig.blockSize)) { 
      this.binIndexLookup = null;
      this.audioIntensities = new Array(this._numBlocks(blockSize)).fill(0);
      this.shuffleLookup = new Array(this.audioIntensities.length).fill(0);
    }
    if (initialConfig.gamma !== gamma) {
      this.updateGamma = true;
    }
  }

  reset() {
    super.reset();
    // TODO ?
  }

  render(dt) {
    const {gpuKernelMgr, framebuffer} = this.voxelModel;
    const {blockSize, levelMax, fadeFactor} = this.config;

    const temp = this.prevVisTex;
    this.prevVisTex = gpuKernelMgr.blockVisFunc(
      this.audioIntensities, this.shuffleLookup, this.prevVisTex, this.currColourLums, blockSize, levelMax, fadeFactor, dt
    );
    temp.delete();

    framebuffer.setBufferTexture(gpuKernelMgr.renderBlockVisualizerAlphaFunc(this.prevVisTex));
    this.timeSinceLastBlockSizeTransition += dt;
  }

  setAudioInfo(audioInfo) {
    super.setAudioInfo(audioInfo);
    const {fft, chroma:audioChroma} = audioInfo;
    const {
      gamma, blurIntensitySpeed, brightenIntensity, levelMax, 
      dynamicBlockSize, dynamicBlockSizeTransitionTimeSecs, shuffleBlocks
    } = this.config;

    // If block size is set to be dynamic then adjust the block size based on how many audio intensities are available...
    if (dynamicBlockSize) {
      const fftLength = fft.length;
      const tempBinLookup = AudioVisualizerAnimator.buildBinIndexLookup(fftLength, MAX_NUM_BLOCKS, gamma);
      Object.keys(tempBinLookup).forEach((key, index) => {
        _tempAudioIntensities[index] = AudioVisualizerAnimator.calcFFTBinLevelMax(tempBinLookup[key], fft);
      });

      const numActiveIntensities = _tempAudioIntensities.filter(intensity => (Math.log10(intensity) / levelMax) > 0.01).length;
      let newBlockSize = this.config.blockSize;

      if (numActiveIntensities < 16)  { newBlockSize = 8; }
      else if (numActiveIntensities < 128) { newBlockSize = 4; }
      else { newBlockSize = 2; }

      if (!this.binIndexLookup || this.updateGamma ||
         (newBlockSize !== this.config.blockSize && this.timeSinceLastBlockSizeTransition >= dynamicBlockSizeTransitionTimeSecs)
      ) {
        this._buildBinsAndShuffleLookup(fftLength, this._numBlocks(newBlockSize), gamma, shuffleBlocks);
        this.config.blockSize = newBlockSize;
        this.updateGamma = false;
        this.timeSinceLastBlockSizeTransition = 0;
      }
    }
    else if (!this.binIndexLookup || this.updateGamma) {
      this._buildBinsAndShuffleLookup(fft.length, this._numBlocks(this.config.blockSize), gamma, shuffleBlocks);
      this.updateGamma = false;
    }

    // Throw the audio levels of the distribution into the proper bins
    const blurDist = this.dtAudioFrame*blurIntensitySpeed;
    let avgAudioIntensity = 0, index = 0;
    for (const key of Object.keys(this.binIndexLookup)) {
      const currAudioIntensity = this.audioIntensities[index];
      const nextAudioIntensity = AudioVisualizerAnimator.calcFFTBinLevelMax(this.binIndexLookup[key], fft);
      this.audioIntensities[index] = currAudioIntensity + blurDist*(nextAudioIntensity-currAudioIntensity);
      avgAudioIntensity += this.audioIntensities[index];
      index++;
    }
    avgAudioIntensity /= index;
    const normAudioIntensity = THREE.MathUtils.clamp(Math.log10(avgAudioIntensity) / levelMax, 0, 1);

    // Calculate the current musical note / synesthesia colour based on the audio's chroma info
    this.currColour.setRGB(0,0,0);
    const chromaAdjusted = AudioVisualizerAnimator.calcAudioChromaAdjusted(audioChroma); // Normalized top half of the audio chroma
    for (let i = 0, chromaLen = chromaAdjusted.length; i < chromaLen; i++) {
      const chromaAdjustedVal = chromaAdjusted[i];
      const noteColour = SCRIABIN_NOTE_COLOURS[i];

      _tempColour.setRGB(noteColour.r, noteColour.g, noteColour.b);
      _tempColour.multiplyScalar(chromaAdjustedVal);
      this.currColour.add(_tempColour);
    }
    this.currColour.setRGB(
      THREE.MathUtils.clamp(this.currColour.r, 0, 1), 
      THREE.MathUtils.clamp(this.currColour.g, 0, 1), 
      THREE.MathUtils.clamp(this.currColour.b, 0, 1)
    );
    
    // Build a set of brightness levels for rendering the colour based on audio intensity
    const currColourHex = this.currColour.getHex();
    const currColourHSL = chroma(currColourHex).hsl();
    const opposingChromaColour = chroma.hsl((currColourHSL[0]+90+(30*(normAudioIntensity-0.5))) % 360, currColourHSL[1], currColourHSL[2]);
    for (let i = 0; i < NUM_LUM_LEVELS; i++) {
      const pct = THREE.MathUtils.smoothstep(i/NUM_LUM_LEVELS_MINUS1, 0, 1);
      const brightenVal = pct*brightenIntensity;
      const glArr = chroma.mix(opposingChromaColour, currColourHex, i/NUM_LUM_LEVELS_MINUS1).saturate(2+pct).brighten(brightenVal).gl();
      const currColourLum = this.currColourLums[i];
      currColourLum[0] = glArr[0]; currColourLum[1] = glArr[1]; currColourLum[2] = glArr[2];
    }
  }
  
  _buildBinsAndShuffleLookup(fftLength, numBlocks, gamma, shuffle) {
    this.binIndexLookup   = AudioVisualizerAnimator.buildBinIndexLookup(fftLength, numBlocks, gamma);
    this.audioIntensities = new Array(numBlocks).fill(0);
    
    // Build a random shuffle of the indices (if enabled)
    const indices = this.audioIntensities.map((_, idx) => idx);
    if (shuffle) {
      this.shuffleLookup = new Array(numBlocks).fill(0);
      // TODO: Have the RNG be seeded for consistency!
      for (let i = 0, numIndices = this.shuffleLookup.length; i < numIndices; i++) {
        const currIdx = Math.floor(Math.random()*indices.length);
        this.shuffleLookup[i] = currIdx;
        indices.splice(currIdx, 1);
      }
    }
    else {
      this.shuffleLookup = indices;
    }
  }

  _numBlocks(blockSize) { return Math.pow(this.voxelModel.gridSize / blockSize, 3); }
}

export default BlockVisualizerAnimator;