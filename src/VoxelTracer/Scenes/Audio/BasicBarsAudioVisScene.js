
import * as THREE from 'three';

import AudioVisUtils from './AudioVisUtils';

import SceneRenderer from '../SceneRenderer';

import VTVoxel from '../../VTVoxel';
import VTLambertMaterial from '../../VTLambertMaterial';
import VTAmbientLight from '../../VTAmbientLight';
import {clamp} from '../../../MathUtils';

export const DEFAULT_LEVEL_MAX = 1.75;
export const DEFAULT_GAMMA = 1.6;
export const DEFAULT_FADE_FACTOR = 0.02;
export const DEFAULT_LOW_COLOUR  = new THREE.Color("#99FC20");
export const DEFAULT_HIGH_COLOUR = new THREE.Color("#FD1999"); 
const DEFAULT_CENTER_SORTED = false;
const DEFAULT_SPLIT_LEVELS  = false;

export const basicBarsAudioVisDefaultConfig = {
  lowColour:    DEFAULT_LOW_COLOUR,
  highColour:   DEFAULT_HIGH_COLOUR,
  centerSorted: DEFAULT_CENTER_SORTED,
  splitLevels:  DEFAULT_SPLIT_LEVELS,
};

class BasicBarsAudioVisScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
    this.timeCounter = 0;

    this.lastAudioFrameTime = Date.now();
    this.currAudioFrameTime = 0;

    this.meshes = [];
    this.spiralMeshIndices = [];
    this.binIndexLookup = null;
  }

  build(options) {
    const {sceneConfig} = options;
    const splitLevels = sceneConfig.splitLevels ? sceneConfig.splitLevels : DEFAULT_SPLIT_LEVELS;

    if (!this._objectsBuilt || this._options.sceneConfig.splitLevels !== splitLevels) {
      const lowColour   = sceneConfig.lowColour   ? sceneConfig.lowColour  : DEFAULT_LOW_COLOUR;
      const highColour  = sceneConfig.highColour  ? sceneConfig.highColour : DEFAULT_HIGH_COLOUR;
      
      const ambientLightColour = new THREE.Color(1,1,1);
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      // Create a grid of cubes that we use to represent frequency levels for each FFT bin
      const xSize = this.voxelModel.xSize();
      const ySize = this.voxelModel.ySize();
      const zSize = this.voxelModel.zSize();
      const halfYSize = Math.floor(ySize/2);

      this.meshes = [];
      const Y_START = splitLevels ? halfYSize : 0;
      const levelColours = [];
      for (let y = Y_START; y < ySize; y++) {
        const t = THREE.MathUtils.smootherstep(y, Y_START, ySize-1);
        const colour = new THREE.Color(lowColour.r, lowColour.g, lowColour.b);
        colour.lerp(highColour, t);
        levelColours.push(colour);
      }

      const voxelOptions = {receivesShadow: false};
      
      for (let x = 0; x < xSize; x++) {
        for (let z = 0; z < zSize; z++) {
          const levelMeshes = [];

          if (splitLevels) {
            const topLevelMeshes = [];
            for (let y = Y_START; y < ySize; y++) {
              const mesh = new VTVoxel(new THREE.Vector3(x,y,z), new VTLambertMaterial(levelColours[y-Y_START], 0), voxelOptions);
              topLevelMeshes.push(mesh);
            }

            const bottomLevelMeshes = [];
            for (let y = Y_START-1; y >= 0; y--) {
              const mesh = new VTVoxel(new THREE.Vector3(x,y,z), new VTLambertMaterial(levelColours[Y_START-y-1], 0), voxelOptions);
              bottomLevelMeshes.push(mesh);
            }

            levelMeshes.push(topLevelMeshes);
            levelMeshes.push(bottomLevelMeshes);
          }
          else {
            for (let y = Y_START; y < ySize; y++) {
              const mesh = new VTVoxel(new THREE.Vector3(x,y,z), new VTLambertMaterial(levelColours[y-Y_START], 0), voxelOptions);
              levelMeshes.push(mesh);
            }
          }
          this.meshes.push(levelMeshes);
        }
      }

      this._buildSpiralMeshIndices();
      this.timeCounter = 0;
      this._objectsBuilt = true;
    }

    this.scene.addLight(this.ambientLight);
    for (let i = 0; i < this.meshes.length; i++) {
      if (splitLevels) {
        const levelMeshes = this.meshes[i];
        const topLevelMeshes = levelMeshes[0];
        const bottomLevelMeshes = levelMeshes[1];

        for (let j = 0; j < topLevelMeshes.length; j++) {
          this.scene.addObject(topLevelMeshes[j]);
          this.scene.addObject(bottomLevelMeshes[j]);
        }
      }
      else {
        for (let j = 0; j < this.meshes[i].length; j++) {
          this.scene.addObject(this.meshes[i][j]);
        }
      }
    }
  }

  _buildSpiralMeshIndices() {
    const xSize = this.voxelModel.xSize();
    const zSize = this.voxelModel.zSize();
    const gridSize = xSize*zSize;

    this.spiralMeshIndices = [];
    const startX = Math.floor(xSize/2);
    const startZ = Math.floor(zSize/2);
    
    // Get concentric rings of voxels
    let r = 1;
    const allIndices = {};
    for (let x = 0; x < xSize; x++) {
      for (let z = 0; z < zSize; z++) {
        allIndices[x*zSize + z] = true;
      }
    }
    
    while (this.spiralMeshIndices.length < gridSize) {
      const rSqr = r*r;
      for (let x = 0; x < xSize; x++) {
        for (let z = 0; z < zSize; z++) {
          const idx = x*zSize + z;
          if (allIndices[idx]) {
            let xDiff = x - startX;
            let zDiff = z - startZ;
            if (xDiff*xDiff + zDiff*zDiff <= rSqr) {
              this.spiralMeshIndices.push(idx);
              allIndices[idx] = false;
            }
          }
        }
      }
      r++;
    }

    //console.log(this.spiralMeshIndices);
    //console.log(this.spiralMeshIndices.length);
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }
    this.scene.render();
    this.timeCounter += dt;
  }

  updateAudioInfo(audioInfo) {
    this.currAudioFrameTime = Date.now();
    const dt = (this.currAudioFrameTime - this.lastAudioFrameTime) / 1000;
    this.lastAudioFrameTime = this.currAudioFrameTime;

    const {sceneConfig} = this._options;

    const levelMax = this._options.levelMax ? this._options.levelMax : DEFAULT_LEVEL_MAX;
    const gamma = this._options.gamma ? this._options.gamma : DEFAULT_GAMMA;
    const fadeFactor = this._options.fadeFactor ? this._options.fadeFactor : DEFAULT_FADE_FACTOR;

    const centerSorted = sceneConfig.centerSorted !== undefined ? sceneConfig.centerSorted : DEFAULT_CENTER_SORTED;
    const splitLevels = sceneConfig.splitLevels ? sceneConfig.splitLevels : DEFAULT_SPLIT_LEVELS;

    const fadeFactorAdjusted = Math.pow(fadeFactor, dt);

    const {fft, rms, spectralRolloff, spectralCentroid} = audioInfo;

    const xSize = this.voxelModel.xSize();
    const ySize = this.voxelModel.ySize();
    const zSize = this.voxelModel.zSize();
    const gridSize = xSize*zSize;

    let numFreqs = Math.floor(fft.length/(gamma+1.8));
    if (fft.length >= gridSize && numFreqs < gridSize) {
      numFreqs = gridSize;
    }
    else if (fft.length < gridSize) {
      console.error("You need to implement grouped level blocks.");
    }

    // Build a distribution of what bins (i.e., meshes) to throw each frequency in
    if (!this.binIndexLookup || numFreqs !== this.binIndexLookup.length) {
      this.binIndexLookup = AudioVisUtils.buildBinIndexLookup(numFreqs, this.meshes.length, gamma);
    }

    // If the frequencies are center sorted, then we place the highest ones in the center of the base of the voxel grid, 
    // then move outwards with the lower ones
    if (centerSorted) {
      // First sort all of the frequency bins by their descending amplitudes
      // (after we add all of the indices in the collective bin index lookup)
      const collectedFFTs = Object.keys(binIndexLookup).map(idx => AudioVisUtils.calcFFTBinLevelSum(this.binIndexLookup[idx], fft));
      collectedFFTs.sort((a,b) => b-a);
    
      // The spiral index list and the sorted fft list should be the same length.
      //console.log(this.spiralMeshIndices.length);
      //console.log(collectedFFTs.length);

      // Now we iterate through the meshes starting from the center and spiraling outward
      for (let i = 0; i < this.spiralMeshIndices.length; i++) {
        const currMeshIdx = this.spiralMeshIndices[i];
        const levelMeshes = this.meshes[currMeshIdx];
        const binLevel = collectedFFTs[i];
        this._updateMeshLevels(binLevel, levelMax, fadeFactorAdjusted, levelMeshes, splitLevels);
      }

    }
    else {
      for (let i = 0; i < this.meshes.length; i++) {
        const fftIndices = this.binIndexLookup[i];
        const binLevel = AudioVisUtils.calcFFTBinLevelSum(fftIndices, fft);
        const levelMeshes = this.meshes[i];
        this._updateMeshLevels(binLevel, levelMax, fadeFactorAdjusted, levelMeshes, splitLevels);
      }
    }
  }

  _updateMeshLevels(binLevel, levelMax, fadeFactorAdjusted, levelMeshes, splitLevels) {
    const updateLevel = (cutoffLvl, lvlMeshes) => {
      for (let k = 0; k < lvlMeshes.length; k++) {
        const alpha = k < cutoffLvl ? 1 : 0;
        const mesh = lvlMeshes[k];
        mesh.material.alpha = clamp(mesh.material.alpha * fadeFactorAdjusted + alpha * (1.0 - fadeFactorAdjusted), 0, 1);
      }
    };

    if (splitLevels) {
      const topLevelMeshes = levelMeshes[0];
      const bottomLevelMeshes = levelMeshes[1];
      const cutoffLevel = Math.floor(clamp(Math.log10(binLevel)/levelMax,0,1) * (topLevelMeshes.length));
      updateLevel(cutoffLevel, topLevelMeshes);
      updateLevel(cutoffLevel, bottomLevelMeshes);
    }
    else {
      const cutoffLevel = Math.floor(clamp(Math.log10(binLevel)/levelMax,0,1) * (levelMeshes.length));
      updateLevel(cutoffLevel, levelMeshes);
    }
  }

}

export default BasicBarsAudioVisScene;