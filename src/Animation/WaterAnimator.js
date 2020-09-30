import * as THREE from 'three';

import LiquidGPU from '../LiquidGPU';
import SimpleLiquid, {LiquidCell} from '../SimpleLiquid';
import Spectrum, {COLOUR_INTERPOLATION_RGB} from '../Spectrum';

import AudioVisualizerAnimator from './AudioVisualizerAnimator';
import VoxelAnimator from './VoxelAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';

export const waterAnimatorDefaultConfig = {
  speed: 1.0,
  gravity: 10,
  confinementScale: 0.12,
  levelSetDamping: 0,
  velAdvectionDamping: 0,
  pressureModulation: 1,

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

    const {gridSize} = this.voxelModel;
    this.liquid = new SimpleLiquid(gridSize);
    /*
    const {gravity, confinementScale, waterLevelEpsilon, 
      levelSetDamping, velAdvectionDamping, pressureModulation} = c;

    this.fluidModel = new LiquidGPU(this.voxelModel.gridSize, this.voxelModel.gpuKernelMgr);
    const B_OFFSET = 0;
    this.fluidModel.setBoundary({
      posXOffset:B_OFFSET, negXOffset:B_OFFSET, 
      posYOffset:B_OFFSET, negYOffset:B_OFFSET, 
      posZOffset:B_OFFSET, negZOffset:B_OFFSET
    });
    // Start by injecting a sphere of liquid
    const {gridSize} = this.voxelModel;
    const halfGridSize = (gridSize+2)/2;
    this.fluidModel.injectSphere([halfGridSize-8, halfGridSize-8, halfGridSize-8], 4);
    this.fluidModel.injectSphere([halfGridSize+8, halfGridSize+8, halfGridSize+8], 4);

    this.fluidModel.gravity = gravity;
    this.fluidModel.confinementScale = confinementScale;
    this.fluidModel.levelSetDamping = levelSetDamping;
    this.fluidModel.velAdvectionDamping = velAdvectionDamping;
    this.fluidModel.pressureModulation = pressureModulation;

    this.genColourLookup();
    */
  }

  reset() {
    super.reset();
    this.t = 0;
  }

  rendersToCPUOnly() { return true; }
  render(dt) {
    const {clamp} = THREE.MathUtils;
    const {speed} = this.config;
    const dtSpeed = dt*speed;

    this.liquid.step(dtSpeed);

    const OFFSET = 1;
    const {cells} = this.liquid;
    const pt = new THREE.Vector3();
    const colour = new THREE.Color();
    for (let x = OFFSET; x < cells.length-OFFSET; x++) {
      for (let y = OFFSET; y < cells[x].length-OFFSET; y++) {
        const cell = cells[x][y];
        pt.set(x-OFFSET,y-OFFSET,0);
        if (cell.type === LiquidCell.SOLID_CELL_TYPE) {
          colour.setRGB(1,1,1);
        }
        else {
          const amt = clamp(cell.liquidVol,0,1);
          colour.setRGB(0,amt,amt);
        }

        this.voxelModel.drawPoint(pt, colour);
      }
    }


    /*
    this.t += dtSpeed;
    if (this.t > 2) {
      const {gridSize} = this.voxelModel;
      const sphereR = (3+Math.random()*3);
      const gridSpan = gridSize+2-2*sphereR;
      this.fluidModel.injectSphere([sphereR + Math.random()*gridSpan, 3+sphereR + Math.random()*(gridSpan-3), sphereR + Math.random()*gridSpan], sphereR);
      //this.fluidModel.injectForceBlob([halfGridSize,1,halfGridSize], 10, 5);
      this.fluidModel.stopSimulation = false;
      this.t = 0;
    }

    
    this.fluidModel.step(dtSpeed);

    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    const {levelSet, boundaryBuf, levelEpsilon} = this.fluidModel;
    gpuFramebuffer.drawWater(this.waterLookup, this.airLookup, levelSet, boundaryBuf, levelEpsilon, [1, 1, 1]);
    */
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