import VoxelConstants from "../VoxelConstants";

export const SCENE_TYPE_SIMPLE    = "Simple";
export const SCENE_TYPE_SHADOW    = "Shadow";
export const SCENE_TYPE_FOG       = "Fog";
export const SCENE_TYPE_GODRAY    = "GodRays";
export const SCENE_TYPE_BEACONS   = "Beacons";
export const SCENE_TYPE_METABALLS = "Metaballs";

export const SCENE_TYPES = [
  SCENE_TYPE_SIMPLE,
  SCENE_TYPE_SHADOW,
  SCENE_TYPE_FOG,
  SCENE_TYPE_GODRAY,
  SCENE_TYPE_BEACONS,
  SCENE_TYPE_METABALLS,
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
const widePositionCtrlOpt = {
  x: {min:-2*VoxelConstants.VOXEL_GRID_SIZE, max:2*VoxelConstants.VOXEL_GRID_SIZE, step:1},
  y: {min:-2*VoxelConstants.VOXEL_GRID_SIZE, max:2*VoxelConstants.VOXEL_GRID_SIZE, step:1},
  z: {min:-2*VoxelConstants.VOXEL_GRID_SIZE, max:2*VoxelConstants.VOXEL_GRID_SIZE, step:1},
};
const spotAnglesCtrlOpt = {
  label: "Spot Light Angles",
  inner: {label: "Inner (°)", min:1, max:45, step:1},
  outer: {label: "Outer (°)", min:45, max:90, step:1},
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
  sphereRadius: 4,
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
  sphereRadius: {label: "Sphere Radius", min:1, max:VoxelConstants.VOXEL_GRID_SIZE, step:0.5},
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
  spotLightAngles: {...spotAnglesCtrlOpt},
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

const beaconsSceneDefaultOptions = {
  fogColour: {r:1, g:1, b:1},
  fogScattering: 0.4,
  ambientLightColour: {r:0, g:0, b:0}, 
  beaconSpotAngles: {inner:35, outer:60},
  beaconAtten: {quadratic:0.015, linear:0},

  beacon1Colour1: {r:1, g:0, b:0}, 
  beacon1Colour2: {r:1, g:0, b:0},
  beacon1RotSpdMultiplier: 1,

  beacon2Colour1: {r:0, g:1, b:0},
  beacon2Colour2: {r:0, g:1, b:0},
  beacon2RotSpdMultiplier: 1,

  beacon3Colour1: {r:0, g:0, b:1},
  beacon3Colour2: {r:0, g:0, b:1},
  beacon3RotSpdMultiplier: 1
};
const beaconRotSpdCtrlOpt = {min:-5, max:5, step:0.1};
const beaconsSceneControlOptions = {
  fogColour: {label: "Fog Colour"},
  fogScattering: {...fogScatteringCtrlOpt},
  ambientLightColour: {label: "Ambient Light Colour"},
  beaconSpotAngles: {...spotAnglesCtrlOpt, label: "Beacon Spot Angles"},
  beaconAtten: {...attenuationCtrlOpt, label: "Beacon Attenuation"},

  beacon1Colour1: {label: "Beacon 1 Colour 1"},
  beacon1Colour2: {label: "Beacon 1 Colour 2"},
  beacon1RotSpdMultiplier: {...beaconRotSpdCtrlOpt, label: "Beacon 1 Rotation Speed Multiplier"},

  beacon2Colour1: {label: "Beacon 2 Colour 1"},
  beacon2Colour2: {label: "Beacon 2 Colour 2"},
  beacon2RotSpdMultiplier: {...beaconRotSpdCtrlOpt, label: "Beacon 2 Rotation Speed Multiplier"},

  beacon3Colour1: {label: "Beacon 3 Colour 1"},
  beacon3Colour2: {label: "Beacon 3 Colour 2"},
  beacon3RotSpdMultiplier: {...beaconRotSpdCtrlOpt, label: "Beacon 3 Rotation Speed Multiplier"},
};

const metaballSceneDefaultOptions = {
  ambientLightColour: {r:0.2, g:0.2, b:0.2},
  materialColour: {r:1, g:1, b:1},
  pointLightsAtten: {quadratic:0.015, linear:0},
  pointLight1Pos: {x: VoxelConstants.VOXEL_GRID_SIZE/2, y: VoxelConstants.VOXEL_GRID_SIZE, z: VoxelConstants.VOXEL_GRID_SIZE},
  speed: 1,
  blobSizeMultiplier: 1.6,
  subtractAmt: 5,
  numBlobs: 4,
  wallX: false, 
  wallY: false, 
  wallZ: false, 
  multiColours: false, 
  hasShadows: false,
  showLights: false,
};
const metaballSceneControlOptions = {
  ambientLightColour: {label: "Ambient Light Colour"},
  materialColour: {label: "Default Ball Colour"},
  pointLightsAtten: {...attenuationCtrlOpt, label: "Point Lights Attenuation"},
  pointLight1Pos: {...widePositionCtrlOpt, label: "Point Light 1 Position"},
  speed: {label: "Speed", min:0.1, max:5, step:0.1},
  blobSizeMultiplier: {label: "Size Multiplier", min:0.5, max:2, step:0.1},
  subtractAmt: { label: "Subtract Amount", min:1, max:30, step:0.1},
  numBlobs: { label: "Number of Blobs", min:1, max:10, step:1},
  wallX: {label: "Show X-Axis Wall?"},
  wallY: {label: "Show Y-Axis Wall?"},
  wallZ: {label: "Show Z-Axis Wall?"},
  multiColours: {label: "Multi-coloured Blobs?"},
  hasShadows: {label: "Shadows?"},
  showLights: {label: "Show Lights?"},
};


export const sceneDefaultOptionsMap = {
  [SCENE_TYPE_SIMPLE]:    {options: simpleSceneDefaultOptions,  constraints: simpleSceneControlOptions},
  [SCENE_TYPE_SHADOW]:    {options: shadowSceneDefaultOptions,  constraints: shadowSceneControlOptions},
  [SCENE_TYPE_FOG]:       {options: fogSceneDefaultOptions,     constraints: fogSceneControlOptions},
  [SCENE_TYPE_GODRAY]:    {options: godRaySceneDefaultOptions,  constraints: godRaySceneControlOptions},
  [SCENE_TYPE_BEACONS]:   {options: beaconsSceneDefaultOptions, constraints: beaconsSceneControlOptions},
  [SCENE_TYPE_METABALLS]: {options: metaballSceneDefaultOptions, constraints: metaballSceneControlOptions},
};

export const sceneAnimatorDefaultConfig = {
  sceneType: SCENE_TYPE_SIMPLE,
  sceneOptions: {...simpleSceneDefaultOptions},
};