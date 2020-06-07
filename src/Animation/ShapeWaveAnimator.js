import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {Randomizer} from './Randomizers';
import {VOXEL_EPSILON, VOXEL_ERR_UNITS} from '../MathUtils';

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
  center: {x: 3.5, y: 3.5, z: 3.5},
  waveSpeed: 3, // units / second
  waveGap: 1, // space between waves
  colourPalette: EIGHTIES_COLOUR_PALETTE,
  colourSelectionMode: COLOUR_SELECTION_RANDOM,
  brightness: 1.0,
  repeat: -1, // This needs to be here for the VoxelAnimator setConfig
};


class WaveShape {
  constructor(voxelModel, center, shape, colour) {
    this.voxelModel = voxelModel;
    this.center = new THREE.Vector3(center.x, center.y, center.z);
    this.shape  = shape;
    this.colour = colour;
    this.radius = 0;
    this.lastDrawRadius = 0;
    this.animationFinished = false;
  }

  drawVoxels(drawRadius, brightness) {
    const adjustedColour = this.colour.clone().multiplyScalar(brightness);
    switch (this.shape) {
      case WAVE_SHAPE_CUBE:
        const minPt = this.getMinPt(drawRadius);
        const maxPt = this.getMaxPt(drawRadius);
        this.voxelModel.drawBox(minPt, maxPt, adjustedColour, false);
        break;
      case WAVE_SHAPE_SPHERE:
        this.voxelModel.drawSphere(this.center, drawRadius, adjustedColour, false);
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
    const voxelGridSize = this.voxelModel.gridSize + VOXEL_EPSILON;
    const minBoundsPt = new THREE.Vector3(-VOXEL_EPSILON,-VOXEL_EPSILON,-VOXEL_EPSILON);
    const maxBoundsPt = new THREE.Vector3(voxelGridSize, voxelGridSize, voxelGridSize);

    switch (this.shape) {
      case WAVE_SHAPE_CUBE:
        const boundingBox = new THREE.Box3(this.getMinPt(this.radius), this.getMaxPt(this.radius));
        return !boundingBox.containsBox(new THREE.Box3(minBoundsPt, maxBoundsPt));
      case WAVE_SHAPE_SPHERE:
        const boundingSphere = new THREE.Sphere(this.center, this.radius + VOXEL_EPSILON);
        return !(boundingSphere.containsPoint(minBoundsPt) && boundingSphere.containsPoint(maxBoundsPt));
      default:
        return false;
    }
  }

  render(dt, waveSpeed, brightness) {
    if (this.animationFinished) {
      return;
    }

    const redrawSampleUnits = VOXEL_ERR_UNITS;

    while (this.radius - this.lastDrawRadius >= redrawSampleUnits) {
      const currDrawRadius = this.lastDrawRadius + redrawSampleUnits;
      this.drawVoxels(currDrawRadius, brightness);
      this.lastDrawRadius = currDrawRadius;
    }

    this.radius += dt*waveSpeed;

    if (!this.isInsideVoxels()) {
      // Draw the last shapes before going outside of the display...

      // Find the largest radius from the center of this wave to the outside of the voxel grid
      const voxelGridSize = this.voxelModel.gridSize + VOXEL_EPSILON;
      const maxVoxelSpacePt = new THREE.Vector3(voxelGridSize,voxelGridSize,voxelGridSize);
      const distMinVec = new THREE.Vector3(Math.abs(this.center.x), Math.abs(this.center.y), Math.abs(this.center.z)); // Since the min point is (0,0,0) just use the absolute value of the center
      const distMaxVec = new THREE.Vector3().subVectors(maxVoxelSpacePt, this.center);
      distMaxVec.set(Math.abs(distMaxVec.x), Math.abs(distMaxVec.y), Math.abs(distMaxVec.z));
      distMaxVec.max(distMinVec);

      const maxRadius = distMaxVec.length() + VOXEL_EPSILON; // Furthest distance from the center of the wave to the bounds of the voxel grid
      while (this.lastDrawRadius <= maxRadius) {
        const currDrawRadius = this.lastDrawRadius + redrawSampleUnits;
        this.drawVoxels(currDrawRadius, brightness);
        this.lastDrawRadius = currDrawRadius;
      }

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
      const {center, waveShape} = this.config;
      const currColour = this.getNextColour();
      return new WaveShape(voxels, center, waveShape, currColour);
    };
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES; }

  setConfig(c) {
    super.setConfig(c);
  }

  render(dt) {
    const {waveSpeed, waveGap, brightness} = this.config;

    const voxelSampleSize = 1 + waveGap;
    const lastShape = this.activeShapes.length > 0 ? this.activeShapes[this.activeShapes.length-1] : null;
    if (!lastShape || lastShape.radius >= voxelSampleSize) {
      this.activeShapes.push(this.buildWaveShapeAnimator());
    }
    
    // Tick/draw each of the animators
    this.activeShapes.forEach((waveShape) => {
      waveShape.render(dt, waveSpeed, brightness);
    });

    // Clean up animators that are no longer visible
    this.activeShapes = this.activeShapes.filter((waveShape) => !waveShape.animationFinished);
  }

  reset() {
    super.reset();
    this.activeShapes = [];
  }
}

export default ShapeWaveAnimator;