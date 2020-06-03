
import * as THREE from 'three';

import {DEFAULT_LEVEL_MAX, DEFAULT_LOW_COLOUR, DEFAULT_HIGH_COLOUR, DEFAULT_GAMMA, DEFAULT_FADE_FACTOR, DEFAULT_CENTER_SORTED} from './BasicBarsAudioVisScene';

import SceneRenderer from '../SceneRenderer';

import VTVoxel from '../../VTVoxel';
import VTLambertMaterial from '../../VTLambertMaterial';
import VTAmbientLight from '../../VTAmbientLight';
import {clamp} from '../../../MathUtils';
import AudioVisUtils from './AudioVisUtils';

export const POS_X_DIR = "+x";
export const NEG_X_DIR = "-x";
export const POS_Z_DIR = "+z";
export const NEG_Z_DIR = "-z";

export const DIRECTION_TYPES = [
  POS_X_DIR,
  NEG_X_DIR,
  POS_Z_DIR,
  NEG_Z_DIR,
];

export const DEFAULT_SPEED = 5;
export const DEFAULT_DIR = POS_Z_DIR;

export const historyBarsAudioVisDefaultConfig = {
  lowColour:        DEFAULT_LOW_COLOUR,
  highColour:       DEFAULT_HIGH_COLOUR,
  speed:            DEFAULT_SPEED,
  direction:        DEFAULT_DIR,
};

class HistoryBarsAudioVisScene extends SceneRenderer {
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
    this.audioFrameBuffer  = [];

    this.meshes = [];
    this.binIndexLookup = null;

    this.dRMSAvg = 0;
    this.lastRMS = 0;
    this.avgBPM = 0;
    this.timeSinceLastBeat = 0;
  }

  build(options) {
    const {sceneConfig} = options;

    if (!this._objectsBuilt) {
      const lowColour  = sceneConfig.lowColour  ? sceneConfig.lowColour  : DEFAULT_LOW_COLOUR;
      const highColour = sceneConfig.highColour ? sceneConfig.highColour : DEFAULT_HIGH_COLOUR;
      const direction  = sceneConfig.direction  ? sceneConfig.direction  : DEFAULT_DIR; 
      
      const ambientLightColour = new THREE.Color(1,1,1);
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      // Create a grid of cubes that we use to represent frequency levels for each FFT bin
      const xSize = this.voxelModel.xSize();
      const ySize = this.voxelModel.ySize();
      const zSize = this.voxelModel.zSize();

      let voxelCoordFunc = null;
      switch (direction) {
        case POS_X_DIR:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(x,y,z);
          break;
        case NEG_X_DIR:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(xSize-x-1,y,z);
          break;
        case POS_Z_DIR:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(z,y,x);
          break;
        case NEG_Z_DIR:
        default:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(z,y,xSize-x-1);
          break;
      }

      this.meshes = [];
      const Y_START = 0;
      const levelColours = [];
      for (let y = Y_START; y < ySize; y++) {
        const t = THREE.MathUtils.smootherstep(y, Y_START, ySize-1);
        const colour = new THREE.Color(lowColour.r, lowColour.g, lowColour.b);
        colour.lerp(highColour, t);
        levelColours.push(colour);
      }
      
      for (let x = 0; x < xSize; x++) {
        for (let z = 0; z < zSize; z++) {
          const levelMeshes = [];        
          for (let y = Y_START; y < ySize; y++) {
            const mesh = new VTVoxel(voxelCoordFunc(x,y,z), new VTLambertMaterial(levelColours[y-Y_START], 0));
            levelMeshes.push(mesh);
          }
          this.meshes.push(levelMeshes);
        }
      }

      // Build an empty audio framebuffer
      this.audioFrameBuffer = [];
      for (let i = 0; i < xSize; i++) {
        this.audioFrameBuffer.push(new Array(zSize).fill(0));
      }

      this.timeCounter = 0;
      this._objectsBuilt = true;
    }

    this.scene.addLight(this.ambientLight);
    for (let i = 0; i < this.meshes.length; i++) {
      for (let j = 0; j < this.meshes[i].length; j++) {
        this.scene.addObject(this.meshes[i][j]);
      }
    }
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }
    this.scene.render();
    
  }

  updateAudioInfo(audioInfo) {

    this.currAudioFrameTime = Date.now();
    const dt = (this.currAudioFrameTime - this.lastAudioFrameTime) / 1000;
    this.lastAudioFrameTime = this.currAudioFrameTime;

    const {sceneConfig} = this._options;

    const levelMax = this._options.levelMax ? this._options.levelMax : 1.5;
    const gamma = this._options.gamma ? this._options.gamma : DEFAULT_GAMMA;
    const fadeFactor = this._options.fadeFactor ? this._options.fadeFactor : DEFAULT_FADE_FACTOR;
    const speed = sceneConfig.speed ? sceneConfig.speed : DEFAULT_SPEED;
    const direction  = sceneConfig.direction  ? sceneConfig.direction  : DEFAULT_DIR; 

    const {fft, rms} = audioInfo;

    const denoisedRMS = rms < 0.001 ? 0 : rms;
    //console.log(denoisedRMS);

    this.dRMSAvg = (this.dRMSAvg + (denoisedRMS - this.lastRMS) / dt) / 2.0;
    if (this.timeSinceLastBeat > 0.0001 && (this.dRMSAvg < 0 && this.lastRMS > 0) || (this.dRMSAvg > 0 && this.lastRMS < 0)) {
      // We crossed zero, count the beat
      this.avgBPM = (0.1*this.avgBPM + 0.9 / this.timeSinceLastBeat);
      this.timeSinceLastBeat = 0;
    }
    else {
      this.timeSinceLastBeat += dt;
      if (this.timeSinceLastBeat > 1) {
        this.avgBPM = 0;
      }
    }
    this.lastRMS = denoisedRMS;

    const xSize = this.voxelModel.xSize();
    const zSize = this.voxelModel.zSize();
    let loopSize = zSize;
    switch (direction) {
      case POS_X_DIR:
      case NEG_X_DIR:
        loopSize = zSize;
        break;
      case POS_Z_DIR:
      case NEG_Z_DIR:
      default:
        loopSize = xSize;
        break;
    }

    let numFreqs = Math.floor(fft.length/(gamma+1.8));

    // Build a distribution of what bins (i.e., meshes) to throw each frequency in
    if (!this.binIndexLookup || numFreqs !== this.binIndexLookup.length) {
      this.binIndexLookup = AudioVisUtils.buildBinIndexLookup(numFreqs, loopSize, gamma);
    }

    // Create the next audio frame from the FFT data
    const newAudioFrame = new Array(loopSize);
    for (let i = 0; i < loopSize; i++) {
      const fftIndices = this.binIndexLookup[i];
      newAudioFrame[i] = AudioVisUtils.calcFFTBinLevelMax(fftIndices, fft);
    }

    const fadeFactorAdjusted = Math.pow(fadeFactor, dt);
    const tempoBeat = this.dRMSAvg > 0 ? denoisedRMS*(this.avgBPM/10) : 1;
    const oneOverSpeed = 1.0 / Math.max(1, speed + tempoBeat);

    if (this.timeCounter > oneOverSpeed) {
      this.audioFrameBuffer.pop();
      this.audioFrameBuffer.unshift(newAudioFrame);
      this.timeCounter -= oneOverSpeed;
    }
    else {
      for (let i = 0; i < loopSize; i++) {
        const fftIndices = this.binIndexLookup[i];
        this.audioFrameBuffer[0][i] = AudioVisUtils.calcFFTBinLevelMax(fftIndices, fft);
      }
      this.timeCounter += dt;
    }

    // Now update the voxel grid based on all the buffer's current audio frames
    for (let i = 0; i < this.audioFrameBuffer.length; i++) {
      const audioFrame = this.audioFrameBuffer[i];
      let meshIdx = i*loopSize;
      for (let j = 0; j < loopSize; j++) {
        const levelMeshes = this.meshes[meshIdx];
        const binLevel = audioFrame[j];
        this._updateMeshLevels(binLevel, levelMax, fadeFactorAdjusted, levelMeshes);
        meshIdx++;
      }
    }
  }

  _updateMeshLevels(binLevel, levelMax, fadeFactorAdjusted, levelMeshes) {
    const updateLevel = (cutoffLvl, lvlMeshes) => {
      for (let k = 0; k < lvlMeshes.length; k++) {
        const alpha = k < cutoffLvl ? 1 : 0;
        const mesh = lvlMeshes[k];
        mesh.material.alpha = clamp(mesh.material.alpha * fadeFactorAdjusted + alpha * (1.0 - fadeFactorAdjusted), 0, 1);
      }
    };

    const cutoffLevel = Math.floor(clamp(Math.log10(binLevel)/levelMax,0,1) * (levelMeshes.length));
    updateLevel(cutoffLevel, levelMeshes);
  }

}

export default HistoryBarsAudioVisScene;