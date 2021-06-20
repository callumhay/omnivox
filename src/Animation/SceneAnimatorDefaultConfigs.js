import VoxelConstants from "../VoxelConstants";

export const SCENE_TYPE_SIMPLE  = "Simple";
export const SCENE_TYPE_SHADOW  = "Shadow";
export const SCENE_TYPE_FOG     = "Fog";
export const SCENE_TYPE_GODRAY  = "GodRays";

export const SCENE_TYPES = [
  SCENE_TYPE_SIMPLE,
  SCENE_TYPE_SHADOW,
  SCENE_TYPE_FOG,
  SCENE_TYPE_GODRAY,
];

const fogScatteringCtrlOpt = {min:0, max:1, step:0.01};
const attenuationCtrlOpt = {
  quadratic: {min:0, max:1, step:0.001},
  linear: {min:0, max:1, step:0.001},
};
const positionCtrlOpt = {
  x: {min:0, max:VoxelConstants.VOXEL_GRID_SIZE-1, step:1},
  y: {min:0, max:VoxelConstants.VOXEL_GRID_SIZE-1, step:1},
  z: {min:0, max:VoxelConstants.VOXEL_GRID_SIZE-1, step:1},
};

const simpleSceneDefaultOptions = {
  sphereRadius: 3,
  sphereColour: {r:1, g:1, b:1},
  sphereEmission: {r:0.1, g:0.1, b:0.1},

  pointLightsSpd: Math.PI,
  pointLight1Colour: {r:1, g:0, b:0},
  pointLight2Colour: {r:0, g:1, b:0},
  pointLight3Colour: {r:0, g:0, b:1},
  pointLightAtten: {quadratic:0.01, linear:0},

  ambientLightColour: {r:0.1, g:0.1, b:0.1},

  textureFilename: '',

  wallX: true,
  wallY: true,
  wallZ: true,
  wallColour: {r:1, g:1, b:1},
};
const simpleSceneControlOptions = {
  sphereRadius: {min:0.5, max:5, step:0.25},
  pointLightsSpd: {min:0, max:Math.PI*6, step:Math.PI/6},
  pointLightAtten: attenuationCtrlOpt,
};

const shadowSceneDefaultOptions = {
  movingBoxSize: {x:5, y:2, z:5},
  movingBoxSpeed: 1.25*Math.PI,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLightColour: {r:1, g:1, b:1},
  pointLightPosition: {x:4, y:0, z:4},
  pointLightAtten: {quadratic:0, linear:0},
};
const shadowSceneControlOptions = {
  movingBoxSize: {x: {min:0.5, max:5, step:0.25}, y: {min:0.5, max:5, step:0.25}, z: {min:0.5, max:5, step:0.25}},
  movingBoxSpeed: {min:0, max:4*Math.PI, step:0.1},
  pointLightPosition: positionCtrlOpt,
  pointLightAtten: attenuationCtrlOpt,
};

const fogSceneDefaultOptions = {
  fogColour: {r:1, g:1, b:1},
  fogScattering: 0.5,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLightColour: {r:1, g:1, b:1},
  pointLightAtten: {quadratic:0.2, linear:0.01},
  spotLightAngles: {inner:25, outer:45},
  spotLightAtten: {quadratic:0.001, linear:0.001}
};
const fogSceneControlOptions = {
  fogScattering: fogScatteringCtrlOpt,
  pointLightAtten: attenuationCtrlOpt,
  spotLightAngles: {
    inner: {min:1, max:45, step:1},
    outer: {min:45, max:90, step:1},
  },
  spotLightAtten: attenuationCtrlOpt,
};

const godRaySceneDefaultOptions = {
  fogColour: {r:1, g:1, b:1},
  fogScattering: 0.6,
  pointLightColour: {r:1, g:1, b:1},
  pointLightPosition: {x:4, y:0, z:4},
  pointLightAtten: {quadratic:0.015, linear:0},
  shapeColour: {r:1, g:1, b:1},
  shapeEmission: {r:0.1, g:0.1, b:1},
  shapeSize: {x:8, y:5, z:5},
  shapeRotationSpd: {x:0, y:0.5*Math.PI, z:0},
};
const godRaySceneControlOptions = {
  fogScattering: fogScatteringCtrlOpt,
  pointLightPosition: positionCtrlOpt,
  pointLightAtten: attenuationCtrlOpt,
  shapeSize: {
    x: {min:1, max:VoxelConstants.VOXEL_GRID_SIZE/2, step:1}, 
    y: {min:1, max:VoxelConstants.VOXEL_GRID_SIZE/2, step:1}, 
    z: {min:1, max:VoxelConstants.VOXEL_GRID_SIZE/2, step:1},
  },
  shapeRotationSpd: {
    x: {min:0, max:2*Math.PI, step:0.1},
    y: {min:0, max:2*Math.PI, step:0.1},
    z: {min:0, max:2*Math.PI, step:0.1},
  }
};

export const sceneDefaultOptionsMap = {
  [SCENE_TYPE_SIMPLE]: {options: simpleSceneDefaultOptions, name: 'simpleSceneOptions', controlParams: simpleSceneControlOptions},
  [SCENE_TYPE_SHADOW]: {options: shadowSceneDefaultOptions, name: 'shadowSceneOptions', controlParams: shadowSceneControlOptions},
  [SCENE_TYPE_FOG]:    {options: fogSceneDefaultOptions,    name: 'fogSceneOptions',    controlParams: fogSceneControlOptions},
  [SCENE_TYPE_GODRAY]: {options: godRaySceneDefaultOptions, name: 'godRaySceneOptions', controlParams: godRaySceneControlOptions},
};

export const sceneAnimatorDefaultConfig = {
  sceneType: SCENE_TYPE_SIMPLE,
  sceneOptions: {...simpleSceneDefaultOptions},
};