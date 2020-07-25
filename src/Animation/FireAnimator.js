import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {Randomizer} from './Randomizers';

import FluidGPU from '../FluidGPU';
import {generateSpectrum, ColourSystems, FIRE_SPECTRUM_WIDTH} from '../Spectrum';
import {PI2} from '../MathUtils';

const REINIT_FLUID_TIME_SECS = 0.1;

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
      this.fluidModel = new FluidGPU(this.voxelModel.gridSize, this.voxelModel.gpuKernelMgr.gpu);
    }
    this.fluidModel.diffusion = 0.0001;
    this.fluidModel.viscosity = 0;
    this.fluidModel.buoyancy  = buoyancy;
    this.fluidModel.cooling   = cooling;
    this.fluidModel.vc_eps    = vorticityConfinement;

    const {startX, endX, startY, startZ, endZ} = this._getFluidModelOffsets();
    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        this.fluidModel.sd[x][startY][z] = 1.0;
      }
    }
    
    if (regenFireLookup) {
      this.genFireColourLookup();
    }
  }

  _getFluidModelOffsets() {
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

    return {startX, endX, startY, startZ, endZ};
  }

  render(dt) {
    const {speed, initialIntensityMultiplier} = this.config;

    // Offsets are used because the fluid model has two extra values on either side of each buffer in all dimensions in order
    // to properly calculate the derivatives within the grid. We need to get the values inside that margin and place them
    // into our voxel grid.
    const {startX, endX, startY, startZ, endZ} = this._getFluidModelOffsets();
    if (this.timeCounterToReinitFluid >= REINIT_FLUID_TIME_SECS) {
      for (let z = startZ; z < endZ; z++) {
        for (let x = startX; x < endX; x++) {
          let f = this.genFunc(x-startX, z-startZ, endX-startX, endZ-startZ, this.t);
          this.fluidModel.sT[x][startY][z] = 1.0 + f*initialIntensityMultiplier;
        }
      }
      this.timeCounterToReinitFluid = 0;
    }
    else {
      this.timeCounterToReinitFluid += dt;
    }

    const speedDt = dt*speed;
    this.fluidModel.step(speedDt);
    this.t += speedDt;

    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    gpuFramebuffer.drawFire(this.fireLookup, this.fluidModel.T, [startX, startY, startZ]);
  }

  reset() {
    super.reset();
    this.randomArray = Randomizer.getRandomFloats(FIRE_SPECTRUM_WIDTH);
    this.t = 0;
    this.timeCounterToReinitFluid = Infinity;
    this.randIdx = 0;
  }

  genFireColourLookup() {
    const {spectrumTempMin, spectrumTempMax, colourSystem} = this.config;
    const spectrum = generateSpectrum(spectrumTempMin, spectrumTempMax, FIRE_SPECTRUM_WIDTH, ColourSystems[colourSystem]);
    const {gpuKernelMgr} = this.voxelModel; 
    this.fireLookup = gpuKernelMgr.fireLookupGen(spectrum);
  }

  _randomValue() {
    const result = this.randomArray[this.randIdx];
    this.randIdx = (this.randIdx+1) % this.randomArray.length;
    return result;
  }

  genFunc(x, y, sx, sy, t) {
    let f = 0;
    let i = 0;

    for (; i < 12; i++) {
      f += (1.0 +
        Math.sin(x/sx*PI2*(this._randomValue()+1)+this._randomValue()*PI2 + this._randomValue()*t) *
        Math.sin(y/sy*PI2*(this._randomValue()+1)+this._randomValue()*PI2 + this._randomValue()*t)) *
        (1 + Math.sin((this._randomValue()+0.5)*t + this._randomValue()*PI2)) * 0.25;
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