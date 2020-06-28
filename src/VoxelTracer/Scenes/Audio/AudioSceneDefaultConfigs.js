import * as THREE from 'three';
import {COLOUR_INTERPOLATION_RGB, COLOUR_INTERPOLATION_HSL} from '../../../Spectrum';

export const DEFAULT_LEVEL_MAX = 1.75;
export const DEFAULT_GAMMA = 1.6;
export const DEFAULT_FADE_FACTOR = 0.02;
export const DEFAULT_LOW_COLOUR  = new THREE.Color("#99FC20");
export const DEFAULT_HIGH_COLOUR = new THREE.Color("#FD1999"); 
export const DEFAULT_CENTER_SORTED = false;
export const DEFAULT_SPLIT_LEVELS  = false;

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

// Fire audio vis types
export const LOW_HIGH_TEMP_COLOUR_MODE    = "Low/High Temp";
export const TEMPERATURE_COLOUR_MODE      = "Temperature";
export const RANDOM_COLOUR_MODE           = "Random";

export const COLOUR_MODES = [
  LOW_HIGH_TEMP_COLOUR_MODE,
  TEMPERATURE_COLOUR_MODE,
  RANDOM_COLOUR_MODE,
];

export const DEFAULT_SPEED = 5;
export const DEFAULT_DIR = NEG_Z_DIR;

export const historyBarsAudioVisDefaultConfig = {
  lowColour:        DEFAULT_LOW_COLOUR.clone(),
  highColour:       DEFAULT_HIGH_COLOUR.clone(),
  colourInterpolationType: COLOUR_INTERPOLATION_RGB,
  speed:            DEFAULT_SPEED,
  tempoMultiplier:  15.0,
  direction:        DEFAULT_DIR,
};

export const basicBarsAudioVisDefaultConfig = {
  lowColour:    DEFAULT_LOW_COLOUR,
  highColour:   DEFAULT_HIGH_COLOUR,
  colourInterpolationType: COLOUR_INTERPOLATION_RGB,
  centerSorted: DEFAULT_CENTER_SORTED,
  splitLevels:  DEFAULT_SPLIT_LEVELS,
};

export const fireAudioVisDefaultConfig = {
  initialIntensityMultiplier: 8,
  speedMultiplier: 1.2,
  coolingMultiplier: 0.9,
  boyancyMultiplier: 0.6,
  turbulenceMultiplier: 1,
  colourMode: LOW_HIGH_TEMP_COLOUR_MODE,
  lowTempColour:  new THREE.Color(0.2, 0, 1),
  highTempColour: new THREE.Color(1, 0, 0.7),
  colourGamma: 1.7,
  randomColourHoldTime: 5,
  randomColourTransitionTime: 2,
  temperatureMin: 100,
  temperatureMax: 3000,
  colourInterpolationType: COLOUR_INTERPOLATION_HSL,
  noise: 0.25,
};