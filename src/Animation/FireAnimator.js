import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {Randomizer} from './Randomizers';

import Fluid, {_I} from '../Fluid';
import {generateSpectrum, ColourSystems} from '../Spectrum';
import {PI2} from '../MathUtils';

const SPECTRUM_WIDTH = 256;

export const fireAnimatorDefaultConfig = {
  speed: 2.0,
  diffusion: 0.0001,
  viscosity: 0.000,
  buoyancy:  5.4,
  cooling:   1.3,
  vorticityConfinement: 8.0,
  spectrumTempMin: 700,
  spectrumTempMax: 1700,
  colourSystem: 'CIEsystem',
};

class FireAnimator extends VoxelAnimator {
  constructor(voxels, config=fireAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  setConfig(c) {
    super.setConfig(c);

    const {diffusion, viscosity, buoyancy, cooling, vorticityConfinement} = c;

    if (!this.fluidModel) {
      this.fluidModel = new Fluid(this.voxelModel);
    }
    this.fluidModel.diffusion = diffusion;
    this.fluidModel.viscosity = viscosity;
    this.fluidModel.buoyancy  = buoyancy;
    this.fluidModel.cooling   = cooling;
    this.fluidModel.vc_eps    = vorticityConfinement;

    this.genFireColourLookup();
  }

  render(dt) {
    super.render(dt);

    const startX = 1;
    const endX = this.voxelModel.xSize()-startX;
    const startZ = 1;
    const endZ = this.voxelModel.zSize()-startZ;
    const endY = this.voxelModel.ySize();

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        let f = this.genFunc(x-startX, z-startZ, endX-startX, endY, this.t, this.randomArray);
        this.fluidModel.sd[this.fluidModel._I(x, 1, z)] = 1.0;
        this.fluidModel.sT[this.fluidModel._I(x, 1, z)] = 1.0 + f*8.0;
      }
    }
    const speedDt = dt*this.config.speed;
    this.fluidModel.step(speedDt);
    this.t += speedDt;

    // Update the voxels...
    const voxelArray = this.voxelModel.voxels;
    for (let x = 0; x < voxelArray.length; x++) {
      for (let y = 0; y < voxelArray[x].length; y++) {
        for (let z = 0; z < voxelArray[x][y].length; z++) {

          // Start by looking up the temperature and density of the flame, both are constrained in [0,1]
          const temperature = this.fluidModel.T[this.fluidModel._I(x,y,z)];
          const density = this.fluidModel.d[this.fluidModel._I(x,y,z)];
          const lighting = 0.6;

          // Use the temp and density to look up the expected colour of the flame at the current voxel
          const temperatureIdx = Math.min(SPECTRUM_WIDTH-1, Math.max(0, Math.round(temperature*(SPECTRUM_WIDTH-1))));
          const densityIdx = Math.min(15, Math.max(0, Math.round(density*15)));
          const intensityIdx = Math.round(lighting*15);

          const voxelColour = this.fireTexture[intensityIdx][densityIdx][temperatureIdx];
          this.voxelModel.drawPoint(new THREE.Vector3(x,y,z), new THREE.Color(voxelColour.a*voxelColour.r, voxelColour.a*voxelColour.g, voxelColour.a*voxelColour.b));
        }
      }
    }
  }

  reset() {
    super.reset();
    this.randomArray = Randomizer.getRandomFloats(SPECTRUM_WIDTH);
    this.t = 0;
  }

  genFireColourLookup() {
    const FIRE_THRESHOLD = 7;
    const MAX_FIRE_ALPHA = 1.0;
    const FULL_ON_FIRE   = 100;

    const {spectrumTempMin, spectrumTempMax, colourSystem} = this.config;
    const spectrum = generateSpectrum(spectrumTempMin, spectrumTempMax, SPECTRUM_WIDTH, ColourSystems[colourSystem]);

    this.fireTexture = [];

    // Create a (16 x 16 x SPECTRUM_WIDTH) 3D texture array for looking up encoded colour based on fire characteristics
    for (let i = 0; i < 16; i++) {
      let iTex = [];
      this.fireTexture.push(iTex);

      for (let j = 0; j < 16; j++) {
        let jTex = [];
        iTex.push(jTex);

        for (let k = 0; k < SPECTRUM_WIDTH; k++) {
          //let intensity = i/16.0;
          //let density = j/16.0;
          //let temperature = k/SPECTRUM_WIDTH;
          
          if (k >= FIRE_THRESHOLD) {
            const currSpectrumVal = spectrum[k];
            jTex.push({
              r: currSpectrumVal.r,
              g: currSpectrumVal.g,
              b: currSpectrumVal.b,
              a: MAX_FIRE_ALPHA * ((k>FULL_ON_FIRE) ? 1.0 : (k-FIRE_THRESHOLD)/(FULL_ON_FIRE-FIRE_THRESHOLD))
            });
          }
          else {
            jTex.push({r: 0, g: 0, b: 0, a: 0});
          }
        }
      }
    }
  }

  genFunc(x, y, sx, sy, t, p) {
    let pi = 0;
    let f = 0;
    let i = 0;

    for (; i < 12; i++) {
      f += (1.0 +
        Math.sin(x/sx*PI2*(p[pi++]+1)+p[pi++]*PI2 + p[pi++]*t) *
        Math.sin(y/sy*PI2*(p[pi++]+1)+p[pi++]*PI2 + p[pi++]*t)) *
        (1 + Math.sin((p[pi++]+0.5)*t + p[pi++]*PI2)) * 0.25;
    }
    f *= 1.0/i;

    let fx = (x < sx*0.9) ? 1.0 : 1.0-(x-sx*0.9)/(sx*0.2);
    if (x < sx*0.1) {
      fx = 0.5 + x/(sx*0.2);
    }
    let fy = (y < sy*0.9) ? 1.0 : 1.0-(y-sy*0.9)/(sy*0.2);
    if (y < sy*0.1) {
      fy = 0.5 + y/(sy*0.2);
    }

    return f * fx * fy;
  }
}

export default FireAnimator;