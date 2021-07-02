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

const fogScatteringCtrlOpt = {label: "Fog Scattering", min:0, max:1, step:0.01};
const attenuationCtrlOpt = {
  label: "Attenuation",
  quadratic: {label: "Quadratic Falloff", min:0, max:1, step:0.001},
  linear: {label: "Linear Falloff", min:0, max:1, step:0.001},
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

  wallX: true,
  wallY: true,
  wallZ: true,
  wallColour: {r:1, g:1, b:1},
};
const simpleSceneControlOptions = {
  sphereRadius: {label: "Sphere Radius", min:0.5, max:5, step:0.25},
  sphereColour: {label: "Sphere Colour"},
  sphereEmission: {label: "Sphere Emission"},
  pointLightsSpd: {label: "Light Speed", min:0, max:Math.PI*6, step:Math.PI/6},
  pointLight1Colour: {label: "Light 1 Colour"},
  pointLight2Colour: {label: "Light 2 Colour"},
  pointLight3Colour: {label: "Light 3 Colour"},
  pointLightAtten: {...attenuationCtrlOpt},
  ambientLightColour: {label: "Ambient Light Colour"},
  wallX: {label: "Show X-Axis Wall?"},
  wallY: {label: "Show Y-Axis Wall?"},
  wallZ: {label: "Show Z-Axis Wall?"},
  wallColour: {label: "Wall Colour"},
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
  movingBoxSize: {
    label: "Moving Box Size",
    x: {min:0.5, max:5, step:0.25}, 
    y: {min:0.5, max:5, step:0.25}, 
    z: {min:0.5, max:5, step:0.25}
  },
  movingBoxSpeed: {label: "Moving Box Speed", min:0, max:4*Math.PI, step:0.1},
  ambientLightColour: {label: "Ambient Light Colour"},
  pointLightColour: {label: "Point Light Colour"},
  pointLightPosition: {...positionCtrlOpt, label: "Light Position"},
  pointLightAtten: {...attenuationCtrlOpt},
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
  fogColour: {label: "Fog Colour"},
  fogScattering: {...fogScatteringCtrlOpt},
  ambientLightColour: {label: "Ambient Light Colour"},
  pointLightColour: {label: "Point Light Colour"},
  pointLightAtten: {...attenuationCtrlOpt, label: "Point Light Attenuation"},
  spotLightAngles: {
    label: "Spot Light Angles",
    inner: {label: "Inner (°)", min:1, max:45, step:1},
    outer: {label: "Outer (°)", min:45, max:90, step:1},
  },
  spotLightAtten: {...attenuationCtrlOpt, label: "Spot Light Attenuation"},
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
  fogColour: {label: "Fog Colour"},
  fogScattering: {...fogScatteringCtrlOpt},
  pointLightColour: {label: "Point Light Colour"},
  pointLightPosition: {...positionCtrlOpt, label: "Light Position"},
  pointLightAtten: {...attenuationCtrlOpt, label: "Point Light Attenuation"},
  shapeColour: {label: "Shape Colour"},
  shapeEmission: {label: "Shape Emission"},
  shapeSize: {
    label: "Shape Size",
    x: {min:1, max:VoxelConstants.VOXEL_GRID_SIZE/2, step:1}, 
    y: {min:1, max:VoxelConstants.VOXEL_GRID_SIZE/2, step:1}, 
    z: {min:1, max:VoxelConstants.VOXEL_GRID_SIZE/2, step:1},
  },
  shapeRotationSpd: {
    label: "Shape Rotation Speed",
    x: {min:0, max:2*Math.PI, step:0.1},
    y: {min:0, max:2*Math.PI, step:0.1},
    z: {min:0, max:2*Math.PI, step:0.1},
  }
};

export const sceneDefaultOptionsMap = {
  [SCENE_TYPE_SIMPLE]: {options: simpleSceneDefaultOptions, constraints: simpleSceneControlOptions},
  [SCENE_TYPE_SHADOW]: {options: shadowSceneDefaultOptions, constraints: shadowSceneControlOptions},
  [SCENE_TYPE_FOG]:    {options: fogSceneDefaultOptions,    constraints: fogSceneControlOptions},
  [SCENE_TYPE_GODRAY]: {options: godRaySceneDefaultOptions, constraints: godRaySceneControlOptions},
};

export const sceneAnimatorDefaultConfig = {
  sceneType: SCENE_TYPE_SIMPLE,
  sceneOptions: {...simpleSceneDefaultOptions},
};