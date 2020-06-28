
import * as THREE from 'three';

import VoxelAnimator from "./VoxelAnimator";
import FireAudioVisScene from '../VoxelTracer/Scenes/Audio/FireAudioVisScene';

import BasicBarsAudioVisScene from "../VoxelTracer/Scenes/Audio/BasicBarsAudioVisScene";
import HistoryBarsAudioVisScene from "../VoxelTracer/Scenes/Audio/HistoryBarsAudioVisScene";

import {soundVisDefaultConfig, SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE, SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE, SOUND_VIZ_FIRE_SCENE_TYPE} from './AudioVisAnimatorDefaultConfigs';

class AudioVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, vtScene, config={...soundVisDefaultConfig}) {
    super(voxelModel, config);

    this.currAudioInfo = null;
    this._clearColour = new THREE.Color(0,0,0);
    this._sceneMap = {
      [SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE]:  new BasicBarsAudioVisScene(vtScene, this.voxelModel),
      [SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE]: new HistoryBarsAudioVisScene(vtScene, this.voxelModel),
      [SOUND_VIZ_FIRE_SCENE_TYPE]: new FireAudioVisScene(vtScene, this.voxelModel),
    };

    this.setConfig(config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SOUND_VIZ; }

  setConfig(c) {
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
    }

    this.voxelModel.clear(this._clearColour);
    this.audioVisualizer.render(dt);
  }

  reset() {
    super.reset();
    this.audioVisualizer.clear();
    this.currAudioInfo = null;
  }
}

export default AudioVisualizerAnimator;