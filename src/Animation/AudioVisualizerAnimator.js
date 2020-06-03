
import * as THREE from 'three';

import VoxelAnimator from "./VoxelAnimator";
import VTScene from '../VoxelTracer/VTScene';
import BasicBarsAudioVisScene, {DEFAULT_LEVEL_MAX, DEFAULT_GAMMA, DEFAULT_FADE_FACTOR, basicBarsAudioVisDefaultConfig} from "../VoxelTracer/Scenes/Audio/BasicBarsAudioVisScene";
import HistoryBarsAudioVisScene from "../VoxelTracer/Scenes/Audio/HistoryBarsAudioVisScene";
import {DEFAULT_NUM_FFT_SAMPLES, DEFAULT_FFT_BUFFER_SIZE} from '../WebClientViewer/SoundController';

export const SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE    = "Basic Bars";
export const SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE  = "History Bars";

export const SOUND_VIZ_TYPES = [
  SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE,
  SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE,
];

export const soundVisDefaultConfig = {
  levelMax: DEFAULT_LEVEL_MAX,
  fftBufferSize: DEFAULT_FFT_BUFFER_SIZE,
  numFFTSamples: DEFAULT_NUM_FFT_SAMPLES,
  gamma: DEFAULT_GAMMA,
  fadeFactor: DEFAULT_FADE_FACTOR,

  sceneType: SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE,
  sceneConfig: {...basicBarsAudioVisDefaultConfig},
};

const AUDIO_BUFFER_SIZE = 1;

class AudioVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, config={...soundVisDefaultConfig}) {
    super(voxelModel, config);
    this.currAudioInfo = null;
    this._clearColour = new THREE.Color(0,0,0);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SOUND_VIZ; }

  setConfig(c) {
    super.setConfig(c);
    if (!this.scene) {
      this.scene = new VTScene(this.voxelModel);
      this.sceneMap = {
        [SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE]:  new BasicBarsAudioVisScene(this.scene, this.voxelModel),
        [SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE]: new HistoryBarsAudioVisScene(this.scene, this.voxelModel),
      };
    }

    const {sceneType} = c;
    this.audioVisualizer = this.sceneMap[sceneType];
    if (this.audioVisualizer) {
      this.audioVisualizer.rebuild(c);
    }
    else {
      this.audioVisualizer = null;
      console.error("Invalid audio scene type: " + sceneType);
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