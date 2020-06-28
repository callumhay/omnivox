import {DEFAULT_LEVEL_MAX, DEFAULT_GAMMA, DEFAULT_FADE_FACTOR, basicBarsAudioVisDefaultConfig} from '../VoxelTracer/Scenes/Audio/AudioSceneDefaultConfigs';
import {DEFAULT_NUM_FFT_SAMPLES, DEFAULT_FFT_BUFFER_SIZE} from '../WebClientViewer/SoundController';

export const SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE    = "Basic Bars";
export const SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE  = "History Bars";
export const SOUND_VIZ_FIRE_SCENE_TYPE                = "Fire";

export const SOUND_VIZ_TYPES = [
  SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE,
  SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE,
  SOUND_VIZ_FIRE_SCENE_TYPE,
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