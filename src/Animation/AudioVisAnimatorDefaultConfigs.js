import * as THREE from 'three';
import {DEFAULT_NUM_FFT_SAMPLES, DEFAULT_FFT_BUFFER_SIZE} from '../WebClientController/SoundManager';
import {COLOUR_INTERPOLATION_LRGB} from '../Spectrum';

const DEFAULT_LEVEL_MAX = 1.75;
const DEFAULT_GAMMA = 2.0;
const DEFAULT_FADE_FACTOR = 0.02;
const DEFAULT_LOW_COLOUR  = new THREE.Color("#99FC20");
const DEFAULT_HIGH_COLOUR = new THREE.Color("#FD1999"); 
const DEFAULT_CENTER_SORTED = false;
const DEFAULT_SPLIT_LEVELS  = false;

const basicBarsAudioVisDefaultConfig = {
  lowColour:    DEFAULT_LOW_COLOUR,
  highColour:   DEFAULT_HIGH_COLOUR,
  colourInterpolationType: COLOUR_INTERPOLATION_LRGB,
  centerSorted: DEFAULT_CENTER_SORTED,
  splitLevels:  DEFAULT_SPLIT_LEVELS,
};

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