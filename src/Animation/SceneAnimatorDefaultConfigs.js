
export const SCENE_TYPE_SIMPLE  = "Simple";
export const SCENE_TYPE_SHADOW  = "Shadow (Basic)";
export const SCENE_TYPE_FOG     = "Fog";
export const SCENE_TYPE_GODRAY  = "God Rays";

export const SCENE_TYPES = [
  SCENE_TYPE_SIMPLE,
  SCENE_TYPE_SHADOW,
  SCENE_TYPE_FOG,
  SCENE_TYPE_GODRAY,
];

export const simpleSceneDefaultOptions = {
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
export const fogSceneDefaultOptions = {
  fogColour: {r:1, g:1, b:1},
  fogScattering: 0.5,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLightColour: {r:1, g:1, b:1},
  pointLightPosition: {x:4, y:0, z:4},
  pointLightAtten: {quadratic:0.3, linear:0},
};
export const shadowSceneDefaultOptions = {
  movingBoxSize: {x: 1.5, y:2, z:1.5},
  movingBoxSpeed: 1.5*Math.PI,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLightColour: {r:1, g:1, b:1},
  pointLightPosition: {x:4, y:0, z:4},
  pointLightAtten: {quadratic:0, linear:0},
};
export const godRaySceneDefaultOptions = {
  fogColour: {r:1, g:1, b:1},
  fogScattering: 0.5,
  pointLightColour: {r:1, g:1, b:1},
  pointLightPosition: {x:4, y:0, z:4},
  pointLightAtten: {quadratic:0.01, linear:0},
  shapeColour: {r:1, g:1, b:1},
  shapeEmission: {r:0.1, g:0.1, b:0.1},
  shapeSize: {x:4, y:4, z:4},
  shapeRotationSpd: {x:0.25*Math.PI, y:0.5*Math.PI, z:0},
};

export const sceneDefaultOptionsMap = {
  SCENE_TYPE_SIMPLE: simpleSceneDefaultOptions,
  SCENE_TYPE_SHADOW: shadowSceneDefaultOptions,
  SCENE_TYPE_FOG:    fogSceneDefaultOptions,
  SCENE_TYPE_GODRAY: godRaySceneDefaultOptions,
};

export const sceneAnimatorDefaultConfig = {
  sceneType: SCENE_TYPE_SIMPLE,
  sceneOptions: {...simpleSceneDefaultOptions},
};