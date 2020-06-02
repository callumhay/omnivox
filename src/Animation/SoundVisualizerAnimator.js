
import * as THREE from 'three';

import VoxelAnimator from "./VoxelAnimator";
import VTScene from '../VoxelTracer/VTScene';
import AudioVisualizerScene, {DEFAULT_LEVEL_MAX, DEFAULT_GAMMA, DEFAULT_FADE_FACTOR, audioVizFullBarDefaultConfig} from "../VoxelTracer/Scenes/AudioVisualizerScene";
import {DEFAULT_NUM_FFT_SAMPLES, DEFAULT_FFT_BUFFER_SIZE} from '../WebClientViewer/SoundController';


export const SOUND_VIZ_FULL_BAR_LEVEL_SCENE_TYPE = "Full Bars";
export const SOUND_VIZ_HAH_BAR_LEVEL_SCENE_TYPE  = "Half-Half Bars";

export const SOUND_VIZ_TYPES = [
  SOUND_VIZ_FULL_BAR_LEVEL_SCENE_TYPE,
  SOUND_VIZ_HAH_BAR_LEVEL_SCENE_TYPE,
];

export const soundVisDefaultConfig = {
  levelMax: DEFAULT_LEVEL_MAX,
  fftBufferSize: DEFAULT_FFT_BUFFER_SIZE,
  numFFTSamples: DEFAULT_NUM_FFT_SAMPLES,
  gamma: DEFAULT_GAMMA,
  fadeFactor: DEFAULT_FADE_FACTOR,

  sceneType: SOUND_VIZ_FULL_BAR_LEVEL_SCENE_TYPE,
  sceneConfig: {...audioVizFullBarDefaultConfig},
};

const AUDIO_BUFFER_SIZE = 1;

class SoundVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, config={...soundVisDefaultConfig}) {
    super(voxelModel, config);
    this.audioInfoBuffer = [];
    this._clearColour = new THREE.Color(0,0,0);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SOUND_VIZ; }

  setConfig(c) {
    super.setConfig(c);
    if (!this.scene) {
      this.scene = new VTScene(this.voxelModel);
    }
    if (!this.audioVisualizer) {
      this.audioVisualizer = new AudioVisualizerScene(this.scene, this.voxelModel);
    }
    this.audioVisualizer.rebuild(c);
  }

  setAudioInfo(audioInfo) {
    if (this.audioInfoBuffer.length >= AUDIO_BUFFER_SIZE) {
      this.audioInfoBuffer.pop();
    }
    this.audioInfoBuffer.unshift(audioInfo);
  }

  render(dt) {
    while (this.audioInfoBuffer.length > 0) {
      this.audioVisualizer.updateAudioInfo(this.audioInfoBuffer.pop());
    }

    this.voxelModel.clear(this._clearColour);
    this.audioVisualizer.render(dt);
  }

  reset() {
    super.reset();
    this.audioVisualizer.clear();
    //this.audioInfoBuffer = [];
  }
}

export default SoundVisualizerAnimator;