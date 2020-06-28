export const simpleSceneDefaultOptions = {
  sphereRadius: 2,
  sphereColour: {r:1, g:1, b:1},

  pointLightsSpd: Math.PI,
  pointLight1Colour: {r:1, g:0, b:0},
  pointLight2Colour: {r:0, g:1, b:0},
  pointLight3Colour: {r:0, g:0, b:1},
  pointLightAtten: {quadratic:0.01, linear:0},

  ambientLightColour: {r:0.05, g:0.05, b:0.05},

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