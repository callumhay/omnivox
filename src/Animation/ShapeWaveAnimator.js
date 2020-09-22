import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';
import {Randomizer} from '../Randomizers';

import VoxelAnimator from './VoxelAnimator';

const EIGHTIES_MAGENTA_HEX    = 0xF00078;
const EIGHTIES_YELLOW_HEX     = 0xFFC70E;
const EIGHTIES_LIME_HEX       = 0x99FC20;
const EIGHTIES_PURPLE_HEX     = 0x993F87;
const EIGHTIES_TEAL_HEX       = 0x1B8772;
const EIGHTIES_TURQUOISE_HEX  = 0x338F8E;
const EIGHTIES_CYAN_HEX       = 0x00E6FE;
const EIGHTIES_STRAWBERRY_HEX = 0xFB2E2B;
const EIGHTIES_ORANGE_HEX     = 0xFF9933;
const EIGHTIES_BLUE_HEX       = 0x24739F;

// Colour Palette Constants
export const EIGHTIES_COLOUR_PALETTE = [
  new THREE.Color(EIGHTIES_MAGENTA_HEX),
  new THREE.Color(EIGHTIES_TURQUOISE_HEX),
  new THREE.Color(EIGHTIES_YELLOW_HEX),
  new THREE.Color(EIGHTIES_LIME_HEX),
  new THREE.Color(EIGHTIES_TEAL_HEX),
  new THREE.Color(EIGHTIES_CYAN_HEX),
  new THREE.Color(EIGHTIES_ORANGE_HEX),
  new THREE.Color(EIGHTIES_PURPLE_HEX),
  new THREE.Color(EIGHTIES_STRAWBERRY_HEX),
  new THREE.Color(EIGHTIES_BLUE_HEX),
];
export const RGB_COLOUR_PALETTE = [
  new THREE.Color(0xff0000),
  new THREE.Color(0x00ff00),
  new THREE.Color(0x0000ff)
];

// Wave Shape Constants
export const WAVE_SHAPE_CUBE   = 'cube';
export const WAVE_SHAPE_SPHERE = 'sphere';
export const WAVE_SHAPE_TYPES = [
  WAVE_SHAPE_CUBE,
  WAVE_SHAPE_SPHERE,
];

// Colour selection constants
export const COLOUR_SELECTION_SEQUENTIAL = 1;
export const COLOUR_SELECTION_RANDOM     = 2;
export const COLOUR_SELECTION_TYPES = [
  COLOUR_SELECTION_SEQUENTIAL,
  COLOUR_SELECTION_RANDOM,
];

export const shapeWaveAnimatorDefaultConfig = {
  waveShape: WAVE_SHAPE_SPHERE,
  center: {x: VoxelConstants.VOXEL_HALF_GRID_IDX, y: VoxelConstants.VOXEL_HALF_GRID_IDX, z: VoxelConstants.VOXEL_HALF_GRID_IDX},
  waveSpeed: 3, // units / second
  waveGap: 1, // space between waves
  colourPalette: EIGHTIES_COLOUR_PALETTE,
  colourSelectionMode: COLOUR_SELECTION_RANDOM,
  brightness: 1.0,
  repeat: -1, // This needs to be here for the VoxelAnimator setConfig
};

class WaveShape {
  constructor(voxelModel, colour, config) {
    const {center, waveShape, waveGap} = config;

    this.voxelModel = voxelModel;
    this.center = new THREE.Vector3(center.x, center.y, center.z);
    this.shape  = waveShape;
    this.gap = waveGap;
    this.colour = colour;
    this.radius = 0;
    this.lastDrawRadius = 0;
    this.animationFinished = false;
    this.removeMe = false;
  }

  drawVoxels(drawRadius, brightness) {
    const adjustedColour = this.colour.clone().multiplyScalar(brightness);
    switch (this.shape) {
      case WAVE_SHAPE_CUBE:
        const minPt = this.getMinPt(drawRadius);
        const maxPt = this.getMaxPt(drawRadius);
        this.voxelModel.drawBox(minPt, maxPt, adjustedColour, true);
        break;
      case WAVE_SHAPE_SPHERE:
        this.voxelModel.drawSphere(this.center, drawRadius, adjustedColour, true);
        break;
      default:
        break;
    }
  }

  getMinPt(r) {
    return this.center.clone().subScalar(r);
  }
  getMaxPt(r) {
    return this.center.clone().addScalar(r);
  }
  isInsideVoxels() {
    const diagGap = Math.sqrt(2*this.gap*this.gap);
    const maxValue = this.voxelModel.gridSize + diagGap + VoxelConstants.VOXEL_EPSILON;
    const minValue = -(diagGap + VoxelConstants.VOXEL_EPSILON);
    const minBoundsPt = new THREE.Vector3(minValue, minValue, minValue);
    const maxBoundsPt = new THREE.Vector3(maxValue, maxValue, maxValue);

    switch (this.shape) {
      case WAVE_SHAPE_CUBE:
        const boundingBox = new THREE.Box3(this.getMinPt(this.radius-1), this.getMaxPt(this.radius-1));
        return !(boundingBox.containsPoint(minBoundsPt) && boundingBox.containsPoint(maxBoundsPt));
      case WAVE_SHAPE_SPHERE:
        const boundingSphere = new THREE.Sphere(this.center, this.radius - VoxelConstants.VOXEL_EPSILON);
        return !(boundingSphere.containsPoint(minBoundsPt) && boundingSphere.containsPoint(maxBoundsPt));
      default:
        return false;
    }
  }

  tick(dt, waveSpeed) {
    if (this.animationFinished) {
      return;
    }
    this.radius += dt*waveSpeed;
    if (!this.isInsideVoxels()) {
      this.animationFinished = true;
    }
  }

  render(dt, waveSpeed, brightness) {
    if (this.animationFinished) {
      return;
    }

    this.drawVoxels(this.radius, brightness);
    this.radius += dt*waveSpeed;

    if (!this.isInsideVoxels()) {
      this.animationFinished = true;
    }
  }
};

class ShapeWaveAnimator extends VoxelAnimator {
  constructor(voxels, config = shapeWaveAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();

    // We define our colour selection based on the selection mode - we load up the colour queue with
    // the configured colour palette and then we pick off the colours that make sense based on the selection mode
    let colourQueue = [];
    this.getNextColour = () => {
      const {colourSelectionMode} = this.config;
      const colourPalette = EIGHTIES_COLOUR_PALETTE; // TODO: Make this dynamically driven from the GUI somehow

      let nextColour = null;

      if (colourQueue.length === 0) {
        colourQueue = [...colourPalette];
      }

      switch (colourSelectionMode) {

        case COLOUR_SELECTION_RANDOM:
          const randIdx = Randomizer.getRandomInt(0, colourQueue.length);
          nextColour = colourQueue[randIdx];
          colourQueue.splice(randIdx, 1);
          break;

        case COLOUR_SELECTION_SEQUENTIAL:
        default:
          nextColour = colourQueue.pop();
          break;
      }

      return nextColour;
    };

    this.buildWaveShapeAnimator = () => {
      const currColour = this.getNextColour();
      return new WaveShape(voxels, currColour, this.config);
    };
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES; }

  setConfig(c) {
    super.setConfig(c);
  }

  render(dt) {
    const {waveSpeed, waveGap, brightness, waveShape, center} = this.config;

    const voxelSampleSize = 1 + waveGap;
    const lastShape = this.activeShapes.length > 0 ? this.activeShapes[this.activeShapes.length-1] : null;
    if (!lastShape || lastShape.radius >= voxelSampleSize) {
      this.activeShapes.push(this.buildWaveShapeAnimator());
    }

    // Build a list of everything we need to render
    const radii = [];
    const colours = [];
    for (let i = this.activeShapes.length-1; i >= 0; i--) {
      const currWaveShape = this.activeShapes[i];
      currWaveShape.tick(dt, waveSpeed);
      radii.push(currWaveShape.radius);
      colours.push(currWaveShape.colour.toArray());

      if (i > 0) {
        const largerThanCurrentWave = this.activeShapes[i-1];
        if (currWaveShape.animationFinished && largerThanCurrentWave.animationFinished) {
          largerThanCurrentWave.removeMe = true;
        }
      }
    }

    // Fill the reamining elements (or remove extra elements) in the arrays up to the grid size 
    // (this is needed to make the array the same size everytime for the GPU)
    for (let i = radii.length; i < 2*this.voxelModel.gridSize; i++) {
      radii.push(0);
      colours.push([0,0,0]);
    }
    for (let i = radii.length; i > 2*this.voxelModel.gridSize; i--) {
      radii.pop();
      colours.pop();
    }

    switch (waveShape) {
      case WAVE_SHAPE_CUBE:
        this.voxelModel.drawCubes([center.x, center.y, center.z], radii, colours, brightness);
        break;
      case WAVE_SHAPE_SPHERE:
        this.voxelModel.drawSpheres([center.x, center.y, center.z], radii, colours, brightness);
        break;
      default:
        break;
    }

    // Clean up animators that are no longer visible
    this.activeShapes = this.activeShapes.filter((waveShape) => !waveShape.removeMe);
  }

  reset() {
    super.reset();
    this.activeShapes = [];
  }
}

export default ShapeWaveAnimator;