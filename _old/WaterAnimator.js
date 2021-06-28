import * as THREE from 'three';

import SimpleLiquid from '../src/SimpleLiquid';
import Spectrum, {COLOUR_INTERPOLATION_RGB} from '../src/Spectrum';

import AudioVisualizerAnimator from '../src/Animation/AudioVisualizerAnimator';
import VoxelAnimator from '../src/Animation/VoxelAnimator';
import {soundVisDefaultConfig} from '../src/Animation/AudioVisAnimatorDefaultConfigs';

export const waterAnimatorDefaultConfig = {
  speed: 1.0,
  gravity: 9.81,
  vorticityConfinement: 0.01,
  viscosity: 0.00015,

  colourInterpolationType: COLOUR_INTERPOLATION_RGB,
  shallowColour:  new THREE.Color(0.4,1,1),
  deepColour: new THREE.Color(0,0,1),

  ...soundVisDefaultConfig,
  audioVisualizationOn: false,
};

class WaterAnimator extends VoxelAnimator {
  constructor(voxelModel, config=waterAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_WATER; }

  setConfig(c) {
    super.setConfig(c);

    const {gridSize, gpuKernelMgr} = this.voxelModel;
    if (!this.liquid) {
      this.liquid = new SimpleLiquid(gridSize, gpuKernelMgr);
    }
    const {liquidSim} = this.liquid;

    const {gravity, viscosity, vorticityConfinement} = c;
    liquidSim.gravity = gravity;
    liquidSim.viscosity = viscosity;
    liquidSim.vorticityConfinement = vorticityConfinement;
  }

  reset() {
    super.reset();
    this.t = 0;
  }

  //rendersToCPUOnly() { return true; }
  render(dt) {
    const {speed} = this.config;
    const dtSpeed = dt*speed;

    this.t += dtSpeed;
    if (this.t > 2) {
      const {gridSize} = this.voxelModel;
      const sphereR = (5+Math.random()*3);
      const halfGridPos = gridSize+2/2;
      const center = [halfGridPos-sphereR, sphereR, halfGridPos-sphereR];//[sphereR + Math.random()*gridSpan, 2, sphereR + Math.random()*gridSpan];
      //this.liquid.injectForceBlob(center, 1e20, sphereR);
      this.t = 0;
    }
  
    this.liquid.step(dtSpeed);

    const {maxCellVolume, cells, pressureField, velField} = this.liquid.liquidSim;
    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    gpuFramebuffer.drawSimpleWater(cells, pressureField, velField, maxCellVolume, [1, 1, 1]);
  }

  setAudioInfo(audioInfo) {
    if (!this.config.audioVisualizationOn) {
      return;
    }
    super.setAudioInfo(audioInfo);
    // TODO
  }

  genColourLookup() {
    // The water colour is dependant on the depth of the water from the surface
    const {deepColour, shallowColour, colourInterpolationType} = this.config;
    const {gridSize} = this.voxelModel;
    this.waterLookup = Spectrum.genLowToHighColourSpectrum(
      shallowColour, deepColour, colourInterpolationType, gridSize/2
    );
    this.airLookup = Spectrum.genLowToHighColourSpectrum(
      new THREE.Color(0,0,0), new THREE.Color(0,0,0), colourInterpolationType, gridSize/2
    );
  }

}

export default WaterAnimator;