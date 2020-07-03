
import * as THREE from 'three';

import VoxelAnimator, {DEFAULT_CROSSFADE_TIME_SECS} from "./VoxelAnimator";
import {soundVisDefaultConfig, SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE, SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE, SOUND_VIZ_FIRE_SCENE_TYPE} from './AudioVisAnimatorDefaultConfigs';

import {clamp} from '../MathUtils';

import {BLEND_MODE_ADDITIVE, BLEND_MODE_OVERWRITE} from '../Server/VoxelModel';

import FireAudioVisScene from '../VoxelTracer/Scenes/Audio/FireAudioVisScene';
import BasicBarsAudioVisScene from "../VoxelTracer/Scenes/Audio/BasicBarsAudioVisScene";
import HistoryBarsAudioVisScene from "../VoxelTracer/Scenes/Audio/HistoryBarsAudioVisScene";

class AudioVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, vtScene, config={...soundVisDefaultConfig}) {
    super(voxelModel, config);

    // Cross-fading variables
    this._totalCrossfadeTime = DEFAULT_CROSSFADE_TIME_SECS;
    this._crossfadeCounter = Infinity;
    this._prevSceneConfig = null;

    this.currAudioInfo = null;
    this._scene = vtScene;
    this._sceneMap = {
      [SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE]:  new BasicBarsAudioVisScene(vtScene, this.voxelModel),
      [SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE]: new HistoryBarsAudioVisScene(vtScene, this.voxelModel),
      [SOUND_VIZ_FIRE_SCENE_TYPE]: new FireAudioVisScene(vtScene, this.voxelModel),
    };

    this.setConfig(config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SOUND_VIZ; }

  setConfig(c) {
    // Check whether the scene type has changed
    if (this.config.sceneType !== c.sceneType) {
      if (this.config.sceneType) {
        // Crossfade between the previous scene and the new scene
        this._prevSceneConfig = this.config;
        this._crossfadeCounter = 0;
      }
    }

    super.setConfig(c);
    
    if (this._sceneMap) {
      const {sceneType} = c;
      this.audioVisualizer = this._sceneMap[sceneType];
      if (this.audioVisualizer) {
        this.audioVisualizer.rebuild(c);
      }
      else {
        this.audioVisualizer = null;
        console.error("Invalid audio scene type: " + sceneType);
      }
    }
  }

  setAudioInfo(audioInfo) {
    this.currAudioInfo = audioInfo;
  }

  render(dt) {
    if (this.currAudioInfo) {
      this.audioVisualizer.updateAudioInfo(this.currAudioInfo);

      // When crossfading we need to update both scenes
      if (this._prevSceneConfig) {
        const prevScene = this._sceneMap[this._prevSceneConfig.sceneType];
        prevScene.updateAudioInfo(this.currAudioInfo);
      }

      this.currAudioInfo = null;
    }

    // Crossfade between scenes
    if (this._prevSceneConfig) {
      const prevScene = this._sceneMap[this._prevSceneConfig.sceneType];

      // Adjust the scene alphas as a percentage of the crossfade time and continue counting the total time until the crossfade is complete
      const percentFade = clamp(this._crossfadeCounter / this._totalCrossfadeTime, 0, 1);

      this.voxelModel.setFrameBuffer(0);
      this.voxelModel.clear(new THREE.Color(0,0,0));
      this._scene.clear();
      prevScene.build(this._prevSceneConfig)
      prevScene.render(dt);
      this.voxelModel.multiply(1-percentFade);

      if (this._crossfadeCounter < this._totalCrossfadeTime) {
        this._crossfadeCounter += dt;
      }
      else {
        // No longer crossfading, just showing the current visualizer
        this._crossfadeCounter = Infinity;
        this._prevSceneConfig = null;
      }

      // Blend with the previous visualizer via framebuffer - we need to do this so that we
      // aren't just overwriting the voxel framebuffer despite the crossfade amounts for each animation
      this.voxelModel.setFrameBuffer(1);
      this.voxelModel.clear(new THREE.Color(0,0,0));
      this._scene.clear();
      this.audioVisualizer.build(this.config);
      this.audioVisualizer.render(dt);
      this.voxelModel.multiply(percentFade);

      this.voxelModel.setFrameBuffer(0);
      this.voxelModel.blendMode = BLEND_MODE_ADDITIVE;
      this.voxelModel.drawFramebuffer(1);
      this.voxelModel.blendMode = BLEND_MODE_OVERWRITE;
    }
    else {
      this.audioVisualizer.render(dt);
    }
  }

  reset() {
    super.reset();
    //this.audioVisualizer.clear();
    //this.currAudioInfo = null;
  }

  setCrossfadeTime(t) {
    this._totalCrossfadeTime = t;
  }

}

export default AudioVisualizerAnimator;