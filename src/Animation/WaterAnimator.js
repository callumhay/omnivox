import * as THREE from 'three';

import LiquidGPU from '../LiquidGPU';
import SimpleLiquid, {LiquidCell, CELL_VOL_IDX, CELL_TYPE_IDX, SOLID_CELL_TYPE} from '../SimpleLiquid';
import Spectrum, {COLOUR_INTERPOLATION_RGB} from '../Spectrum';

import AudioVisualizerAnimator from './AudioVisualizerAnimator';
import VoxelAnimator from './VoxelAnimator';
import {soundVisDefaultConfig} from './AudioVisAnimatorDefaultConfigs';

export const waterAnimatorDefaultConfig = {
  speed: 1.0,
  gravity: 9.81,
  vorticityConfinement: 0.5,
  viscosity: 0.0001,

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

  //rendersToCPUOnly() { return true; }
  render(dt) {
    const {clamp} = THREE.MathUtils;
    const {speed} = this.config;
    const dtSpeed = dt*speed;

    this.liquid.step(dtSpeed);

    const OFFSET = 1;
    const {cells, maxLiquidVol, flowSumField} = this.liquid.liquidSim;
    // Update the voxels...
    const gpuFramebuffer = this.voxelModel.framebuffer;
    gpuFramebuffer.drawSimpleWater(cells, maxLiquidVol, [1, 1, 1]);
    
    /*
    const pt = new THREE.Vector3();
    const colour = new THREE.Color();
    const flowSums = flowSumField.toArray();

    for (let x = OFFSET; x < cells.length-OFFSET; x++) {
      for (let y = OFFSET; y < cells[x].length-OFFSET; y++) {
        const cell = cells[1][y][x];
        const cellType = cell[CELL_TYPE_IDX];
        const cellLiquidVol = cell[CELL_VOL_IDX];
        pt.set(x-OFFSET,y-OFFSET,0);
        if (cellType === SOLID_CELL_TYPE) {
          colour.setRGB(1,1,1);
        }
        else {
          const amt = clamp(cellLiquidVol,0,1);
          const extra = clamp(4*(cellLiquidVol-maxLiquidVol),0,1);
          colour.setRGB(extra,amt/2,amt);
        }

        this.voxelModel.drawPoint(pt, colour);

        //const flowSum = flowSums[x][y][1];
        //colour.setRGB(Math.min(Math.abs(flowSum), 1), 0, 0);
        //pt.z = this.voxelModel.gridSize-1;
        //this.voxelModel.drawPoint(pt, colour);

        // Debug: Draw the velocity buffer
        const {velField} = this.liquid.liquidSim;
        const u = velField[x][y][1];
        pt.z = this.voxelModel.gridSize-1;
        colour.setRGB(
          Math.min(Math.abs(u[0]/10), 1), 
          Math.min(Math.abs(u[1]/10), 1),
          Math.min(Math.abs(u[2]/10), 1));
        this.voxelModel.drawPoint(pt, colour);
      }
    }
    */


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