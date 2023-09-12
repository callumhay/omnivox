import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';
import {Randomizer} from '../Randomizers';
import {PALETTE_MAP, COLOUR_PALETTE_TYPES} from '../Spectrum';

import VoxelAnimator from './VoxelAnimator';

// Wave Shape Constants
const WAVE_SHAPE_CUBE    = "Cube";
const WAVE_SHAPE_SPHERE  = "Sphere";
const WAVE_SHAPE_DIAMOND = "Diamond";
export const WAVE_SHAPE_TYPES = [
  WAVE_SHAPE_CUBE,
  WAVE_SHAPE_SPHERE,
  WAVE_SHAPE_DIAMOND,
];

// Colour selection constants
export const COLOUR_SELECTION_SEQUENTIAL = "Sequential";
export const COLOUR_SELECTION_RANDOM     = "Random";
export const COLOUR_SELECTION_TYPES = [
  COLOUR_SELECTION_SEQUENTIAL,
  COLOUR_SELECTION_RANDOM,
];

export const shapeWaveAnimatorDefaultConfig = {
  waveShape: WAVE_SHAPE_SPHERE,
  center: {x: VoxelConstants.VOXEL_HALF_GRID_IDX, y: VoxelConstants.VOXEL_HALF_GRID_IDX, z: VoxelConstants.VOXEL_HALF_GRID_IDX},
  waveSpeed: 6, // (in voxels / second)
  waveGap: 1,   // space between waves (in voxels)
  colourPaletteName: COLOUR_PALETTE_TYPES[0],
  colourSelectionMode: COLOUR_SELECTION_RANDOM,
};

const _minBoundsPt = new THREE.Vector3();
const _maxBoundsPt = new THREE.Vector3();
const _minPt = new THREE.Vector3();
const _maxPt = new THREE.Vector3();
const _tempBox = new THREE.Box3();
const _tempSphere = new THREE.Sphere();

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

  getMinPt(target, r) {
    return target.copy(this.center).subScalar(r);
  }
  getMaxPt(target, r) {
    return target.copy(this.center).addScalar(r);
  }
  isInsideVoxels() {
    const diagGap = Math.sqrt(2*this.gap*this.gap);
    const maxValue = this.voxelModel.gridSize + diagGap + VoxelConstants.VOXEL_EPSILON;
    const minValue = -(diagGap + VoxelConstants.VOXEL_EPSILON);
    _minBoundsPt.set(minValue, minValue, minValue);
    _maxBoundsPt.set(maxValue, maxValue, maxValue);

    switch (this.shape) {

      case WAVE_SHAPE_CUBE:
        _tempBox.set(this.getMinPt(_minPt, this.radius-1), this.getMaxPt(_maxPt, this.radius-1));
        return !(_tempBox.containsPoint(_minBoundsPt) && _tempBox.containsPoint(_maxBoundsPt));
      
      case WAVE_SHAPE_SPHERE:
        _tempSphere.set(this.center, this.radius - VoxelConstants.VOXEL_EPSILON);
        return !(_tempSphere.containsPoint(_minBoundsPt) && _tempSphere.containsPoint(_maxBoundsPt));

      case WAVE_SHAPE_DIAMOND:
        _tempSphere.set(this.center, Math.SQRT1_2*this.radius - VoxelConstants.VOXEL_EPSILON);
        return !(_tempSphere.containsPoint(_minBoundsPt) && _tempSphere.containsPoint(_maxBoundsPt));

      default:
        return false;
    }
  }

  tick(dt, waveSpeed) {
    if (this.animationFinished) { return; }
    this.radius += Math.min(1.0, dt*waveSpeed);
    if (!this.isInsideVoxels()) { this.animationFinished = true; }
  }
}

class ShapeWaveAnimator extends VoxelAnimator {
  constructor(voxelModel, config = shapeWaveAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES; }

  _reinit() {
    this.activeShapes = [];
    this.colourQueue = [];
  }
  load() {
    this._reinit();
  }
  unload() {
    this.activeShapes = null;
    this.colourQueue = null;
  }
  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; }
    this.colourQueue = [];
  }
  reset() {
    this._reinit();
  }

  render(dt) {
    const {waveSpeed, waveGap, waveShape, center} = this.config;

    const voxelSampleSize = 1 + waveGap;
    const lastShape = this.activeShapes.length > 0 ? this.activeShapes[this.activeShapes.length-1] : null;
    if (!lastShape || lastShape.radius >= voxelSampleSize) {
      this.activeShapes.push(new WaveShape(this.voxelModel, this._getNextColour(), this.config));
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
        this.voxelModel.drawCubes([center.x, center.y, center.z], radii, colours, 1);
        break;
      case WAVE_SHAPE_SPHERE:
        this.voxelModel.drawSpheres([center.x, center.y, center.z], radii, colours, 1);
        break;
      case WAVE_SHAPE_DIAMOND:
        this.voxelModel.drawDiamonds([center.x, center.y, center.z], radii, colours, 1);
        break;
      default:
        break;
    }

    // Clean up animators that are no longer visible
    this.activeShapes = this.activeShapes.filter((waveShape) => !waveShape.removeMe);
  }

  _getNextColour() {
    const {colourSelectionMode, colourPaletteName} = this.config;
    
    const colourPalette = PALETTE_MAP[colourPaletteName];
    if (this.colourQueue.length === 0) { this.colourQueue = [...colourPalette]; }

    let nextColourHex = null;
    switch (colourSelectionMode) {

      case COLOUR_SELECTION_RANDOM:
        const randIdx = Randomizer.getRandomInt(0, this.colourQueue.length);
        nextColourHex = this.colourQueue[randIdx];
        this.colourQueue.splice(randIdx, 1);
        break;

      case COLOUR_SELECTION_SEQUENTIAL:
      default:
        nextColourHex = this.colourQueue.pop();
        break;
    }

    return new THREE.Color(nextColourHex);
  }
}

export default ShapeWaveAnimator;
