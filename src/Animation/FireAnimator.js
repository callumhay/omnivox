import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {Randomizer} from './Randomizers';

import Fluid, {_I} from '../Fluid';
import {generateSpectrum, ColourSystems, FIRE_SPECTRUM_WIDTH} from '../Spectrum';
import {PI2} from '../MathUtils';

export const fireAnimatorDefaultConfig = {
  speed: 2.0,
  buoyancy:  1.2,
  cooling:   1,
  initialIntensityMultiplier: 8,
  vorticityConfinement: 8.0,
  spectrumTempMin: 500,
  spectrumTempMax: 1700,
  colourSystem: 'CIEsystem',
};

class FireAnimator extends VoxelAnimator {
  constructor(voxelModel, config=fireAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_FIRE; }

  setConfig(c) {
    let regenFireLookup = false;
    {
      const {spectrumTempMin, spectrumTempMax, colourSystem} = this.config;
      regenFireLookup = (c.spectrumTempMin !== spectrumTempMin || c.spectrumTempMax !== spectrumTempMax || c.colourSystem !== colourSystem);
    }

    super.setConfig(c);

    const {buoyancy, cooling, vorticityConfinement} = c;

    if (!this.fluidModel) {
      this.fluidModel = new Fluid(this.voxelModel.gridSize);
    }
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = buoyancy;
    this.fluidModel.cooling   = cooling;
    this.fluidModel.vc_eps    = vorticityConfinement;

    if (regenFireLookup) {
      this.genFireColourLookup();
    }
  }

  render(dt) {
    const {speed, initialIntensityMultiplier} = this.config;

    const xSize = this.voxelModel.xSize();
    const zSize = this.voxelModel.zSize();

    // Offsets are used because the fluid model has two extra values on either side of each buffer in all dimensions in order
    // to properly calculate the derivatives within the grid. We need to get the values inside that margin and place them
    // into our voxel grid.
    const startX = 1;
    const endX = xSize+startX;
    const startZ = 1;
    const endZ = zSize+startZ;
    const startY = 1;

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        let f = this.genFunc(x-startX, z-startZ, endX-startX, endZ-startZ, this.t, this.randomArray);
        const idx = this.fluidModel._I(x, startY, z);
        this.fluidModel.sd[idx] = 1.0;
        this.fluidModel.sT[idx] = 1.0 + f*initialIntensityMultiplier;
      }
    }
    const speedDt = dt*speed;
    this.fluidModel.step(speedDt);
    this.t += speedDt;

    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    gpuFramebuffer.drawFire(this.fireLookup, this.fluidModel.T, [startX, startY, startZ]);

    /*
    const tempColour = new THREE.Color();
    const voxelArray = this.voxelModel.voxels;
    const voxelPos = new THREE.Vector3();
    for (let x = 0; x < voxelArray.length; x++) {
      for (let y = 0; y < voxelArray[x].length; y++) {
        for (let z = 0; z < voxelArray[x][y].length; z++) {

          // Start by looking up the temperature and density of the flame, both are constrained in [0,1]
          const idx = this.fluidModel._I(x+startX,y+startY,z+startZ);
          const temperature = this.fluidModel.T[idx];
          const density = this.fluidModel.d[idx];
          const lighting = 0.6;

          // Use the temp and density to look up the expected colour of the flame at the current voxel
          const temperatureIdx = Math.min(FIRE_SPECTRUM_WIDTH-1, Math.max(0, Math.round(temperature*(FIRE_SPECTRUM_WIDTH-1))));
          const densityIdx = Math.min(15, Math.max(0, Math.round(density*15)));
          const intensityIdx = Math.round(lighting*15);

          const voxelColour = this.fireTexture[intensityIdx][densityIdx][temperatureIdx];
          
          tempColour.setRGB(voxelColour.a*voxelColour.r, voxelColour.a*voxelColour.g, voxelColour.a*voxelColour.b);
          this.voxelModel.setVoxel(voxelPos.set(x,y,z), tempColour);
        }
      }
    }
    */
  }

  reset() {
    super.reset();
    this.randomArray = Randomizer.getRandomFloats(FIRE_SPECTRUM_WIDTH);
    this.t = 0;
  }

  genFireColourLookup() {
    const {spectrumTempMin, spectrumTempMax, colourSystem} = this.config;
    const spectrum = generateSpectrum(spectrumTempMin, spectrumTempMax, FIRE_SPECTRUM_WIDTH, ColourSystems[colourSystem]);

    const {gpuKernelMgr} = this.voxelModel; 
    this.fireLookup = gpuKernelMgr.fireLookupGen(spectrum);

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