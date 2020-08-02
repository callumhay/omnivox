import * as THREE from 'three';
import chroma from 'chroma-js';

import AudioVisUtils from '../src/VoxelTracer/Scenes/Audio/AudioVisUtils';

import SceneRenderer from '../src/VoxelTracer/Scenes/SceneRenderer';

import VTVoxel from '../src/VoxelTracer/VTVoxel';
import VTLambertMaterial from '../src/VoxelTracer/VTLambertMaterial';
import VTAmbientLight from '../src/VoxelTracer/VTAmbientLight';
import {clamp} from '../src/MathUtils';

import {DEFAULT_SPLIT_LEVELS, DEFAULT_LOW_COLOUR, DEFAULT_HIGH_COLOUR, DEFAULT_LEVEL_MAX, DEFAULT_GAMMA} from '../src/VoxelTracer/Scenes/Audio/AudioSceneDefaultConfigs';

class BasicBarsAudioVisScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;

    this.lastAudioFrameTime = Date.now();
    this.currAudioFrameTime = 0;

    this.meshes = [];
    this.spiralMeshIndices = [];
    this.binIndexLookup = null;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    const {sceneConfig} = options;
    const splitLevels = sceneConfig.splitLevels ? sceneConfig.splitLevels : DEFAULT_SPLIT_LEVELS;

    if (!this._objectsBuilt || this._options.sceneConfig.splitLevels !== splitLevels) {

      const { colourInterpolationType } = options.sceneConfig;

      const lowColour = (sceneConfig.lowColour.r !== undefined && sceneConfig.lowColour.g && sceneConfig.lowColour.b) ?
        sceneConfig.lowColour : DEFAULT_LOW_COLOUR;
      const highColour = (sceneConfig.highColour.r !== undefined && sceneConfig.highColour.g && sceneConfig.highColour.b) ?
        sceneConfig.highColour : DEFAULT_HIGH_COLOUR;

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
        const t = (y-Y_START) / (ySize-Y_START-1);
        const temp = chroma.mix(chroma.gl(lowColour), chroma.gl(highColour), t, colourInterpolationType).gl();
        levelColours.push(new THREE.Color(temp[0], temp[1], temp[2]));
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
    const spiralXZIndices = AudioVisUtils.buildSpiralIndices(xSize,zSize);

    this.spiralMeshIndices = [];
    for (let i = 0; i < spiralXZIndices.length; i++) {
      const idx = spiralXZIndices[i][0]*zSize + spiralXZIndices[i][1];
      this.spiralMeshIndices.push(idx);
    }
  }

  async render(dt) {
    if (!this._objectsBuilt) { return; }
    await this.scene.render();
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

    const {fft} = audioInfo;

    const xSize = this.voxelModel.xSize();
    //const ySize = this.voxelModel.ySize();
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
      const collectedFFTs = Object.keys(this.binIndexLookup).map(idx => AudioVisUtils.calcFFTBinLevelSum(this.binIndexLookup[idx], fft));
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
        const {material} = mesh;
        material.alpha = clamp(material.alpha * fadeFactorAdjusted + alpha * (1.0 - fadeFactorAdjusted), 0, 1);
        mesh.setMaterial(material);
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