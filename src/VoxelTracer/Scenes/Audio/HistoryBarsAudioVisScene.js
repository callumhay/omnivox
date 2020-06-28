
import * as THREE from 'three';
import chroma from 'chroma-js';

import {
  DEFAULT_LOW_COLOUR, DEFAULT_HIGH_COLOUR, DEFAULT_GAMMA, DEFAULT_FADE_FACTOR, DEFAULT_SPEED, DEFAULT_DIR,
  POS_X_DIR, NEG_X_DIR, POS_Z_DIR, NEG_Z_DIR
} from './AudioSceneDefaultConfigs';

import SceneRenderer from '../SceneRenderer';

import VTVoxel from '../../VTVoxel';
import VTLambertMaterial from '../../VTLambertMaterial';
import VTAmbientLight from '../../VTAmbientLight';
import {clamp} from '../../../MathUtils';
import AudioVisUtils from './AudioVisUtils';
import VTPointLight from '../../VTPointLight';

const ptLightDistFromFront = 10;

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
    this.lastdRMS = 0;
    this.lastRMS = 0;
    this.avgBeatsPerSec = 0;
    this.avgSpectralCentroid = 0;
    this.timeSinceLastBeat = 0;
  }

  build(options) {
    const {sceneConfig} = options;
    
    if (!this._objectsBuilt) {

      const { colourInterpolationType } = options.sceneConfig;

      const lowColour = (sceneConfig.lowColour.r !== undefined && sceneConfig.lowColour.g && sceneConfig.lowColour.b) ?
        sceneConfig.lowColour : DEFAULT_LOW_COLOUR;
      const highColour = (sceneConfig.highColour.r !== undefined && sceneConfig.highColour.g && sceneConfig.highColour.b) ?
        sceneConfig.highColour : DEFAULT_HIGH_COLOUR;
      const direction  = sceneConfig.direction  ? sceneConfig.direction  : DEFAULT_DIR;
      
      const ambientLightColour = new THREE.Color(1,1,1);
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      // Create a grid of cubes that we use to represent frequency levels for each FFT bin
      const xSize = this.voxelModel.xSize();
      const ySize = this.voxelModel.ySize();
      const zSize = this.voxelModel.zSize();

      let voxelCoordFunc = null;
      let ptLightPos = new THREE.Vector3();
      
      switch (direction) {
        case POS_X_DIR:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(x,y,z);
          ptLightPos.set(-ptLightDistFromFront, ySize/2 + 0.5, zSize/2 - 0.5);
          break;
        case NEG_X_DIR:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(xSize-x-1,y,z);
          ptLightPos.set(xSize + ptLightDistFromFront, ySize/2 + 0.5, zSize/2 - 0.5);
          break;
        case POS_Z_DIR:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(z,y,x);
          ptLightPos.set(xSize/2 - 0.5, ySize/2 + 0.5, -ptLightDistFromFront);
          break;
        case NEG_Z_DIR:
        default:
          voxelCoordFunc = (x,y,z) => new THREE.Vector3(z,y,xSize-x-1);
          ptLightPos.set(xSize/2 - 0.5, ySize/2 + 0.5, zSize+ptLightDistFromFront);
          break;
      }

      this.spectralPtLight = new VTPointLight(ptLightPos, new THREE.Color(0,0,0), {quadratic:0.5, linear:0, constant:0});

      this.meshes = [];
      const Y_START = 0;
      const levelColours = [];
      for (let y = Y_START; y < ySize; y++) {
        const t = THREE.MathUtils.smootherstep(y, Y_START, ySize-1);
        const temp = chroma.mix(chroma.gl(lowColour), chroma.gl(highColour), t, colourInterpolationType).gl();
        levelColours.push(new THREE.Color(temp[0], temp[1], temp[2]));
      }
      
      const voxelOptions = {receivesShadow: false};
      for (let x = 0; x < xSize; x++) {
        for (let z = 0; z < zSize; z++) {
          const levelMeshes = [];        
          for (let y = Y_START; y < ySize; y++) {
            const mesh = new VTVoxel(voxelCoordFunc(x,y,z), new VTLambertMaterial(levelColours[y-Y_START], 0, null, true), voxelOptions);
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
    this.scene.addLight(this.spectralPtLight);
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
    const tempoMultiplier = sceneConfig.tempoMultiplier ? sceneConfig.tempoMultiplier : 1;
    const direction  = sceneConfig.direction  ? sceneConfig.direction  : DEFAULT_DIR; 

    const {fft, rms, spectralCentroid} = audioInfo;

    this.avgSpectralCentroid = (this.avgSpectralCentroid + spectralCentroid) / 2.0;

    const denoisedRMS = rms < 0.01 ? 0 : rms;
    this.dRMSAvg = (this.dRMSAvg + (denoisedRMS - this.lastRMS) / dt) / 2.0;
    if (this.timeSinceLastBeat > 0.0001 && (this.dRMSAvg < 0 && this.lastdRMS > 0) || (this.dRMSAvg > 0 && this.lastdRMS < 0)) {
      // We crossed zero, count the beat
      this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 1.0 / this.timeSinceLastBeat) / 2.0, 0, 80);
      this.timeSinceLastBeat = 0;
    }
    else {
      this.timeSinceLastBeat += dt;
      if (this.timeSinceLastBeat > 1) {
        this.avgBeatsPerSec = clamp((this.avgBeatsPerSec + 0.01) / 2.0, 0, 80);
      }
    }

    this.lastRMS  = denoisedRMS;
    this.lastdRMS = this.dRMSAvg;
  
    const xSize = this.voxelModel.xSize();
    const zSize = this.voxelModel.zSize();
    let loopSize = zSize;
    let minSpectralCoord = 0;
    let maxSpectralCoord = zSize-1;
    let spectralComponent = 'z';
    switch (direction) {
      case POS_X_DIR:
        loopSize = zSize;
        minSpectralCoord = 0;
        maxSpectralCoord = zSize-1;
        spectralComponent = 'z';
        break;
      case NEG_X_DIR:
        minSpectralCoord = zSize-1;
        maxSpectralCoord = 0;
        loopSize = zSize;
        spectralComponent = 'z';
        break;
      case POS_Z_DIR:
        minSpectralCoord = xSize-1;
        maxSpectralCoord = 0;
        loopSize = xSize;
        spectralComponent = 'x';
        break;
      case NEG_Z_DIR:
      default:
        minSpectralCoord = 0;
        maxSpectralCoord = xSize-1;
        loopSize = xSize;
        spectralComponent = 'x';
        break;
    }

    let numFreqs = Math.floor(fft.length/(gamma+1.8));

    const spectralLightCoord = THREE.MathUtils.lerp(minSpectralCoord, maxSpectralCoord, clamp(this.avgSpectralCentroid/(numFreqs/2), 0, 1));
    this.spectralPtLight.position[spectralComponent] = (this.spectralPtLight.position[spectralComponent] + spectralLightCoord) / 2.0;
    //console.log(spectralLightCoord);

    const colourRMS = (this.spectralPtLight.colour.r + clamp(denoisedRMS*2, 0, 0.333)) / 2.0; // NOTE: rms is typically pretty small (usually less than 0.2)
    this.spectralPtLight.colour.setRGB(colourRMS, colourRMS, colourRMS);
    this.spectralPtLight.attenuation.quadratic = (this.spectralPtLight.attenuation.quadratic + 1.0 / (Math.max(0.01, ptLightDistFromFront*ptLightDistFromFront*10*denoisedRMS))) / 2.0;

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
    const tempoBeat = clamp(THREE.MathUtils.smootherstep(this.avgBeatsPerSec, 0, 80), 0, 1)*tempoMultiplier;

    const oneOverSpeed = 1.0 / Math.max(1, speed + tempoBeat);

    if (this.timeCounter >= oneOverSpeed) {
      const numFrames = Math.min(this.audioFrameBuffer.length, Math.floor(this.timeCounter/oneOverSpeed));
      for (let i = 0; i < numFrames; i++) {
        this.audioFrameBuffer.pop();
        this.audioFrameBuffer.unshift(newAudioFrame);
      }

      this.timeCounter -= numFrames * oneOverSpeed;
    }
    else {
      for (let i = 0; i < loopSize; i++) {
        const fftIndices = this.binIndexLookup[i];
        this.audioFrameBuffer[0][i] = (AudioVisUtils.calcFFTBinLevelMax(fftIndices, fft) + this.audioFrameBuffer[0][i])/2;
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