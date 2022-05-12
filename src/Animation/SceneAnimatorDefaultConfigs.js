import VTPEase from "../VoxelTracer/Particles/VTPEase";

import { COLOUR_PALETTE_TYPES } from "../Spectrum";
import VoxelConstants from "../VoxelConstants";

export const SCENE_TYPE_SIMPLE    = "Simple";
export const SCENE_TYPE_SHADOW    = "Shadow";
export const SCENE_TYPE_FOG       = "Fog";
export const SCENE_TYPE_GODRAY    = "GodRays";
export const SCENE_TYPE_BEACONS   = "Beacons";
export const SCENE_TYPE_METABALLS = "Metaballs";
export const SCENE_TYPE_BOUNCY    = "Bouncy";
export const SCENE_TYPE_PARTICLE  = "Particle";
export const SCENE_TYPE_PARTICLE_PHYS = "Physics Particle";
export const SCENE_TYPE_BOX_TEST = "Box Test";

export const SCENE_TYPES = [
  SCENE_TYPE_SIMPLE,
  SCENE_TYPE_SHADOW,
  SCENE_TYPE_FOG,
  SCENE_TYPE_GODRAY,
  SCENE_TYPE_BEACONS,
  SCENE_TYPE_METABALLS,
  SCENE_TYPE_BOUNCY,
  SCENE_TYPE_PARTICLE,
  SCENE_TYPE_PARTICLE_PHYS,
  SCENE_TYPE_BOX_TEST,
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
  noiseAlpha: 0,
  noiseSpeed: 0,
  distortHorizontal: 0,
  distortVertical: 0,

  sphereRadius: 4,
  sphereColour: {r:1, g:1, b:1},
  sphereEmission: {r:0.1, g:0.1, b:0.1},
  sphereFill: false,

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
  noiseAlpha: {label: "Noise Alpha", min: 0, max:1, step:0.01},
  noiseSpeed: {label: "Noise Speed", min:0, max:10, step:0.1},
  distortHorizontal: {label: "Horizontal Distortion", min: 0, max:10, step: 0.1},
  distortVertical: {label: "Vertical Distortion", min: 0, max:10, step: 0.1},

  sphereRadius: {label: "Sphere Radius", min:0.5, max:5, step:0.25},
  sphereColour: {label: "Sphere Colour"},
  sphereEmission: {label: "Sphere Emission"},
  sphereFill: {label: "Sphere Fill?"},

  pointLightsSpd: {label: "Light Speed", min:0, max:Math.PI*4, step:0.01},
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
  movingBoxSize: {x:3, y:2, z:4},
  movingBoxSpeed: 0.5*Math.PI,
  sphereRadius: 3,
  sphereFill: false,
  sphereSpeed: 0.5*Math.PI,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLightColour: {r:1, g:1, b:1},
  pointLightPosition: {x:VoxelConstants.VOXEL_HALF_GRID_SIZE-1, y:0, z:VoxelConstants.VOXEL_HALF_GRID_SIZE-1},
  pointLightAtten: {quadratic:0, linear:0},
};
const shadowSceneControlOptions = {
  movingBoxSize: {
    label: "Moving Box Size",
    x: {min:0.5, max:5, step:0.25}, 
    y: {min:0.5, max:5, step:0.25}, 
    z: {min:0.5, max:5, step:0.25}
  },
  movingBoxSpeed: {label: "Box Speed", min:0, max:4*Math.PI, step:0.1},
  sphereRadius: {label: "Sphere Radius", min:1, max:VoxelConstants.VOXEL_GRID_SIZE, step:0.5},
  sphereFill: {label: "Sphere Fill?"},
  sphereSpeed: {label: "Sphere Speed", min:0, max:4*Math.PI, step:0.1},
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
  ambientLightColour: {r:0.2, g:0.2, b:0.2},
  pointLightColour: {r:1, g:0, b:1},
  pointLightPosition: {x:4, y:0, z:4},
  pointLightAtten: {quadratic:0.015, linear:0},
  shapeColour: {r:1, g:1, b:1},
  shapeEmission: {r:0, g:0, b:0},
  shapeSize: {x:8, y:5, z:5},
  shapeRotationSpd: {x:0, y:0.5*Math.PI, z:0},
};
const godRaySceneControlOptions = {
  fogColour: {label: "Fog Colour"},
  fogScattering: {...fogScatteringCtrlOpt},
  ambientLightColour: {label: "Ambient Light Colour"},
  pointLightColour: {label: "Point Light Colour"},
  pointLightPosition: {...positionCtrlOpt, label: "Light Position"},
  pointLightAtten: {...attenuationCtrlOpt, label: "Point Light Attenuation"},
  shapeColour: {label: "Shape Colour"},
  shapeEmission: {label: "Shape Emission"},
  shapeSize: {
    label: "Shape Size",
    x: {min:1, max:VoxelConstants.VOXEL_HALF_GRID_IDX, step:1}, 
    y: {min:1, max:VoxelConstants.VOXEL_HALF_GRID_IDX, step:1}, 
    z: {min:1, max:VoxelConstants.VOXEL_HALF_GRID_IDX, step:1},
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
  fogScattering: 1,
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
  pointLight1Pos: {x: VoxelConstants.VOXEL_GRID_SIZE/2, y: VoxelConstants.VOXEL_GRID_MAX_IDX, z: VoxelConstants.VOXEL_GRID_MAX_IDX},
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

const bouncySceneDefaultOptions = {
  ambientLightColour: {r:0.25, g:0.25, b:0.25},
  dirLight1Colour: {r:1, g:1, b:1},
  dirLight1Dir: {x:1, y:-1, z:1},
  dirLight2Colour: {r:0.66, g:0.66, b:0.66},
  dirLight2Dir: {x:-0.75, y:-0.2, z:-0.5},
  numSpheres: 3,
  minSphereRadius: 2,
  maxSphereRadius: 3.5,
  sphereDensity: 2,
  gravity: -9.8,
  bounciness: 1,
  friction: 0.0,
  maxInitialVelocity: 4,
};
const bouncySceneControlOptions = {
  ambientLightColour: {label: "Ambient Light Colour"},
  dirLight1Colour: {label: "Light 1 Colour"},
  dirLight1Dir: {label: "Light 1 Direction"},
  dirLight2Colour: {label: "Light 2 Colour"},
  dirLight2Dir: {label: "Light 2 Direction"},
  numSpheres: {label: "Number of Spheres", min:1, max:10, step:1},
  minSphereRadius: {label: "Min Sphere Radius", min:1, max:5, step:0.5},
  maxSphereRadius: {label: "Max Sphere Radius", min:1, max:5, step:0.5},
  sphereDensity: {label: "Sphere Density (kg/voxel)", min:0.1, max:10, step:0.1},
  gravity: {label: "Gravity (voxel/s^2)", min:-20, max:20, step:0.2},
  bounciness: {label: "Bounciness", min:0, max:1, step:0.01},
  friction: {label: "Friction", min:0, max:1, step:0.01},
  maxInitialVelocity: {label: "Max Initial Velocity", min:1, max:20, step:0.25},
};

const boxTestSceneDefaultOptions = {
  boxAlpha: 1,
  boxFill: false,
  boxCastsShadows: true,
  boxReceivesShadows: true,
  boxTranslation: {x:VoxelConstants.VOXEL_HALF_GRID_UNIT, y:VoxelConstants.VOXEL_HALF_GRID_UNIT, z:VoxelConstants.VOXEL_HALF_GRID_UNIT},
  boxRotation: {x:0, y:0, z:0},
  boxScale: {x:1, y:1, z:1},
  ambientLightColour: {r:0.25, g:0.25, b:0.25},
  pointLight1Pos: {x: VoxelConstants.VOXEL_GRID_SIZE-3, y:VoxelConstants.VOXEL_GRID_SIZE-5, z: VoxelConstants.VOXEL_GRID_SIZE-4},
  pointLight1Colour: {r:1, g:0, b:1},
  pointLightsAtten: {quadratic:0.008, linear:0},
};
const boxTestSceneControlOptions = {
  boxAlpha: {label: "Box Alpha", min:0, max:1, step:0.01},
  boxFill: {label: "Box Fill?"},
  boxCastsShadows: {label: "Box Casts Shadows?"},
  boxReceivesShadows: {label: "Box Receives Shadows?"},
  boxTranslation: {
    label: "Box Translation",
    x: {label: "x", min:-VoxelConstants.VOXEL_GRID_SIZE, max:VoxelConstants.VOXEL_GRID_SIZE, step:0.5},
    y: {label: "y", min:-VoxelConstants.VOXEL_GRID_SIZE, max:VoxelConstants.VOXEL_GRID_SIZE, step:0.5},
    z: {label: "z", min:-VoxelConstants.VOXEL_GRID_SIZE, max:VoxelConstants.VOXEL_GRID_SIZE, step:0.5}
  },
  boxRotation: {
    label: "Box Rotation",
    x: {label: "x°", min:0, max:360, step:15},
    y: {label: "y°", min:0, max:360, step:15},
    z: {label: "z°", min:0, max:360, step:15}
  },
  boxScale: {
    label: "Box Scale",
    x: {label: "x", min:0.5, max:VoxelConstants.VOXEL_HALF_GRID_SIZE, step:0.25},
    y: {label: "y", min:0.5, max:VoxelConstants.VOXEL_HALF_GRID_SIZE, step:0.25},
    z: {label: "z", min:0.5, max:VoxelConstants.VOXEL_HALF_GRID_SIZE, step:0.25}
  },
  ambientLightColour: {label: "Ambient Light Colour"},
  pointLight1Pos: {...widePositionCtrlOpt, label: "Point Light 1 Position"},
  pointLight1Colour: {label: "Light 1 Colour"},
  pointLightsAtten: {...attenuationCtrlOpt, label: "Point Lights Attenuation"},
};

const particleSceneDefaultOptions = {
  ambientLightColour: {r:0.0, g:0.0, b:0.0},

  blurSqrSigma: 0,
  blurKernelSize: 3,
  blurConserveEnergy: false,

  chromaticAberrationIntensity: 0,
  chromaticAberrationAlpha: 1,
  chromaticAberrationOffsets: {x:1, y:1, z:1},
  
  particleSpawn: {numMin: 5, numMax: 10, interval: 0.05},
  particleLifeSpan: {min: 1, max: 1.5},
  particleSpeed: {min: 4, max: 8},
  particleColourStart: {colourA: {r:1, g:1, b:1}, colourB: {r:1, g:1, b:1}},
  particleColourEnd: {colourA: {r:0, g:1, b:1}, colourB: {r:1, g:0, b:1}},
  particleAlphaStart: {min: 1, max: 1},
  particleAlphaEnd: {min: 1, max: 1},
  particleAlphaEasing: VTPEase.EASE_FUNC_NAMES[0],
  particleMaterial: "VTEmissionMaterial",

  emitterType: 'point',
  emitterPos: {
    x:VoxelConstants.VOXEL_HALF_GRID_UNIT,
    y:VoxelConstants.VOXEL_HALF_GRID_UNIT,
    z:VoxelConstants.VOXEL_HALF_GRID_UNIT
  },
  totalEmitTimes: {num: 1, isInfinity: true},
  
  enableAttractor: false,
  attractorForce: 50,
  attractorRadius: VoxelConstants.VOXEL_GRID_SIZE,
  attractorPos: { x:0, y:15, z:0 },
};
const particleSceneControlOptions = {
  ambientLightColour: {label: "Ambient Light Colour"},

  blurSqrSigma: {label: "Blur Squared Std. Dev", min:0, max:2, step:0.001},
  blurKernelSize: {label: "Blur Kernel Size", min:3, max:15, step:1},
  blurConserveEnergy: {label: "Blur Conserve Energy?"},

  chromaticAberrationIntensity: {
    label: "Chromatic Abberation Intensity",
    min:-VoxelConstants.VOXEL_HALF_GRID_SIZE, max:VoxelConstants.VOXEL_HALF_GRID_SIZE, step:1
  },
  chromaticAberrationAlpha: {
    label: "Chromatic Abberation Alpha",
    min: 0, max:1, step:0.01,
  },
  chromaticAberrationOffsets: {
    label: "Chromatic Abberation Offsets",
    x: {label: "x", min: -1, max:1, step:1},
    y: {label: "y", min: -1, max:1, step:1},
    z: {label: "z", min: -1, max:1, step:1},
  },

  particleSpawn: {
    label: "Particle Spawning", 
    numMin: {label: "Min Particles", min:0, max:50, step:1}, 
    numMax: {label: "Max Particles", min:0, max:50, step:1}, 
    interval: {label: "Interval (s)", min:0.01, max:2, step:0.01},
  },
  particleLifeSpan: {
    label: "Particle Life", 
    min: {label: "Min Life (s)", min: 0.1, max: 10, step:0.1}, 
    max: {label: "Max Life (s)", min: 0.1, max: 10, step:0.1}
  },
  particleSpeed: {
    label: "Particle Speed", 
    min: {label: "Min Speed (voxel/s)", min: 0.1, max: 32, step:0.1}, 
    max: {label: "Max Speed (voxel/s)", min: 0.1, max: 32, step:0.1}
  },
  particleColourStart: {
    label: "Particle Starting Colour Mix",
    colourA: {label: "Colour A"}, colourB: {label: "Colour B"},
  },
  particleColourEnd: {
    label: "Particle Ending Colour Mix",
    colourA: {label: "Colour A"}, colourB: {label: "Colour B"},
  },
  particleAlphaStart: {
    label: "Particle Alpha Start Range", 
    min: {label: "Min Alpha", min: 0, max: 1, step: 0.01}, 
    max: {label: "Max Alpha", min: 0, max: 1, step: 0.01}
  },
  particleAlphaEnd: {
    label: "Particle Alpha End Range", 
    min: {label: "Min Alpha", min: 0, max: 1, step: 0.01}, 
    max: {label: "Max Alpha", min: 0, max: 1, step: 0.01}
  },
  particleAlphaEasing: {
    label: "Particle Alpha Easing",
    list: [...VTPEase.EASE_FUNC_NAMES],
  },
  particleMaterial: {
    label: "Particle Material",
    list: ["VTEmissionMaterial", "VTLambertMaterial"],
  },

  emitterType: {
    label: "Emitter Type",
    list: ['point', 'box'],
  },
  emitterPos: {label: "Emitter Position", ...positionCtrlOpt},
  totalEmitTimes: {
    label: "Emitter Cycles",
    num: {label: "Number of Cycles", min:1, max:10, step:1}, 
    isInfinity: {label: "Infinite Cycles?"}
  },

  enableAttractor: {label: "Enable Attractor?"},
  attractorForce: {label: "Attractor Force", min:-100, max:100, step:1},
  attractorRadius: {label: "Attractor Radius", min:1, max:VoxelConstants.VOXEL_GRID_SIZE*4, step:1},
  attractorPos: { label: "Attractor Position", ...positionCtrlOpt},
};

const particlePhysicsSceneDefaultOptions = {
  particleSpawn: {numMin: 16, numMax: 16, interval: 1},
  particleLife:  {min: 8, max: 10},
  particleSpeed: {min: 8, max: 12},
  particleMass:  {min: 0.5, max: 1},
  particleRadius: {min: 1, max: 3},
  particleType: "VTVoxel",
  particleColourPalette: COLOUR_PALETTE_TYPES[0],

  emitterPos: {
    x:VoxelConstants.VOXEL_HALF_GRID_UNIT,
    y:VoxelConstants.VOXEL_HALF_GRID_UNIT,
    z:VoxelConstants.VOXEL_HALF_GRID_UNIT
  },
  emitterConeAngle: 30,

  gravity: {x: 0, y:-9.8, z:0},
  bounciness: 0.4,
  friction: 0.5,
  enableParticleCollisions: false,
};
const particlePhysicsSceneControlOptions = {
  particleSpawn: {
    label: "Particle Spawning", 
    numMin: {label: "Min Particles", min:0, max:32, step:1}, 
    numMax: {label: "Max Particles", min:0, max:32, step:1}, 
    interval: {label: "Interval (s)", min:0.01, max:2, step:0.01},
  },
  particleLife: {
    label: "Particle Life", 
    min: {label: "Min Life (s)", min: 0.1, max: 10, step:0.1}, 
    max: {label: "Max Life (s)", min: 0.1, max: 10, step:0.1}
  },
  particleSpeed: {
    label: "Particle Speed", 
    min: {label: "Min Speed (voxel/s)", min: 0.1, max: 32, step:0.1}, 
    max: {label: "Max Speed (voxel/s)", min: 0.1, max: 32, step:0.1}
  },
  particleMass: {
    label: "Particle Mass",
    min: {label: "Min Mass (kg)", min:0.1, max:10, step: 0.1},
    max: {label: "Max Mass (kg)", min:0.1, max:10, step: 0.1}
  },
  particleRadius: {
    label: "Particle Radius (Spheres Only)",
    min: {label: "Min Radius (voxels)", min:1, max:5, step:0.5},
    max: {label: "Max Radius (voxels)", min:1, max:5, step:0.5},
  },
  particleType: {
    label: "Particle Type",
    list: ["VTVoxel", "VTSphere"]
  },
  particleColourPalette: {
    label: "Particle Colour Palette",
    list: [...COLOUR_PALETTE_TYPES]
  },

  emitterPos: {label: "Emitter Position", ...positionCtrlOpt},
  emitterConeAngle: {label: "Emitter Cone Angle (°)", min:0, max:90, step:1},

  gravity: {
    label: "Gravity (voxel/s^2)", 
    x: {min:-20, max:20, step:0.2},
    y: {min:-20, max:20, step:0.2},
    z: {min:-20, max:20, step:0.2},
  },
  bounciness: {label: "Bounciness", min:0, max:1, step:0.01},
  friction: {label: "Friction", min:0, max:1, step:0.01},
  enableParticleCollisions: {label: "Particle Collisions?"},
};

export const sceneDefaultOptionsMap = {
  [SCENE_TYPE_SIMPLE]:        {options: simpleSceneDefaultOptions,          constraints: simpleSceneControlOptions},
  [SCENE_TYPE_SHADOW]:        {options: shadowSceneDefaultOptions,          constraints: shadowSceneControlOptions},
  [SCENE_TYPE_FOG]:           {options: fogSceneDefaultOptions,             constraints: fogSceneControlOptions},
  [SCENE_TYPE_GODRAY]:        {options: godRaySceneDefaultOptions,          constraints: godRaySceneControlOptions},
  [SCENE_TYPE_BEACONS]:       {options: beaconsSceneDefaultOptions,         constraints: beaconsSceneControlOptions},
  [SCENE_TYPE_METABALLS]:     {options: metaballSceneDefaultOptions,        constraints: metaballSceneControlOptions},
  [SCENE_TYPE_BOUNCY]:        {options: bouncySceneDefaultOptions,          constraints: bouncySceneControlOptions},
  [SCENE_TYPE_PARTICLE]:      {options: particleSceneDefaultOptions,        constraints: particleSceneControlOptions},
  [SCENE_TYPE_PARTICLE_PHYS]: {options: particlePhysicsSceneDefaultOptions, constraints: particlePhysicsSceneControlOptions},
  [SCENE_TYPE_BOX_TEST]:      {options: boxTestSceneDefaultOptions,         constraints: boxTestSceneControlOptions},

};

export const sceneAnimatorDefaultConfig = {
  sceneType: SCENE_TYPE_SIMPLE,
  sceneOptions: {...simpleSceneDefaultOptions},
};