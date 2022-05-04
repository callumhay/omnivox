import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import VoxelColourAnimator, {INTERPOLATION_SMOOTHER, VOXEL_COLOUR_SHAPE_TYPE_POINT} from './VoxelColourAnimator';
import {COLOUR_INTERPOLATION_LRGB} from '../Spectrum';
import VoxelConstants from '../VoxelConstants';

export const shootingStarAnimatorDefaultConfig = {
  colour: {r:1, g:1, b:1},
  startPosition: {x:0, y:0, z:VoxelConstants.VOXEL_GRID_MAX_IDX},
  velocity: {x:5, y:0, z:0},
  fadeTimeSecs: 0.75
};

const _tempVec3 = new THREE.Vector3();
const _nVelocity = new THREE.Vector3();
const _velocityRay = new THREE.Ray();

/**
 * The ShootingStarAnimator will animate a single "shooting star", a voxel
 * that has a tail which moves from a given starting position in a given
 * direction until it has left the display.
 */
class ShootingStarAnimator extends VoxelAnimator {
  constructor(voxels, config={...shootingStarAnimatorDefaultConfig}) {
    super(voxels, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_SHOOTING_STAR; }

  load() {
    this.currPosition = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.currAnimators = [];
    this.animationFinished = false;
  }
  unload() {
    this.currPosition = null;
    this.velocity = null;
    this.currAnimators = null;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; } // Don't load everything on initialization
    const {startPosition, velocity} = this.config;
    this.currPosition.set(startPosition.x, startPosition.y, startPosition.z);
    this.velocity.set(velocity.x, velocity.y, velocity.z);
  }

  reset() {
    this.resetLoop();
    this.currAnimators = []; // An array of voxel positions to active animators
    this.animationFinished = false;
  }

  resetLoop() {
    const {startPosition} = this.config;
    this.currPosition.set(startPosition.x, startPosition.y, startPosition.z);
  }

  addPositionToAnimatorMap(voxelPosition) {
    // The animator map cannot be longer than the longest sequence of voxels in the cube
    if (this.currAnimators.length >= Math.ceil(VoxelConstants.VOXEL_DIAGONAL_GRID_SIZE)) { return false; }

    // Check to see if the current position has an animator yet...
    for (let i = 0; i < this.currAnimators.length; i++) {
      if (this.currAnimators[i].voxelPosition.distanceToSquared(voxelPosition) < VoxelConstants.VOXEL_ERR_UNITS) {
        return false;
      }
    }

    const {colour, fadeTimeSecs} = this.config;

    // No animator exists for the given position / voxel, create one.
    const animatorConfig = {
      shapeType: VOXEL_COLOUR_SHAPE_TYPE_POINT,
      pointProperties: {point: voxelPosition},
      colourStart: colour,
      colourEnd: {r:0, g:0, b:0},
      startTimeSecs: 0.0,
      endTimeSecs: fadeTimeSecs,
      interpolation: INTERPOLATION_SMOOTHER,
      colourInterpolationType: COLOUR_INTERPOLATION_LRGB,
    };
    const animator = new VoxelColourAnimator(this.voxelModel);
    animator.load();
    animator.setConfig(animatorConfig);
    this.currAnimators.push({voxelPosition, animator});

    return true;
  }

  rendersToCPUOnly() { return true; }

  render(dt) {
    if (this.animationFinished) { return; }

    const roundedCurrPos = this.currPosition.clone().round();
    const currPosInBounds = this.voxelModel.isInBounds(this.currPosition);
    if (currPosInBounds) {
      this.addPositionToAnimatorMap(roundedCurrPos);
    }

    // Animate/tick the active animator objects
    for (const animatorData of this.currAnimators) { animatorData.animator.render(dt); }

    // Clean up all finished animations (only keep the ones that haven't finished and are still in bounds)
    this.currAnimators = this.currAnimators.filter((animatorObj) => {
      return !animatorObj.animator.animationFinished && this.voxelModel.isInBounds(animatorObj.voxelPosition);
    });

    // Check to see whether this shooting star is finished: 
    // i.e., out of bounds, not heading towards the bounds, and has no animations left
    if (this.currAnimators.length === 0 && !currPosInBounds) {

      _nVelocity.copy(this.velocity).normalize();
      _velocityRay.set(this.currPosition, _nVelocity);
      const voxelsBox = this.voxelModel.getBoundingBox();
      
      if (_velocityRay.intersectBox(voxelsBox, _tempVec3) === null) {
        this.animationFinished = true;
        return;
      }
    }

    const sampleStepSize = VoxelConstants.VOXEL_ERR_UNITS; // Sample at a reasonable enough rate
    const sqSampleStepSize = sampleStepSize * sampleStepSize;
    const incVelocity = _tempVec3.copy(this.velocity).multiplyScalar(dt);
    const sqLenIncVel = incVelocity.lengthSq();

    // Perform sampling along the velocity addition in increments equal to a properly sized interval
    // to ensure we don't skip voxels
    if (sqLenIncVel > sqSampleStepSize && this.currAnimators.length < Math.ceil(VoxelConstants.VOXEL_DIAGONAL_GRID_SIZE)) {
      const numSamples = Math.min(Math.floor(incVelocity.length() / sampleStepSize), 2*VoxelConstants.VOXEL_GRID_SIZE+1);
      _nVelocity.copy(this.velocity).normalize();
      for (let i = 1; i <= numSamples; i++) {
        const samplePos = this.currPosition.clone().add(_nVelocity.multiplyScalar(i*sampleStepSize));
        this.addPositionToAnimatorMap(samplePos.round());
      }
    }
    
    this.currPosition.add(incVelocity);
  }

};

export default ShootingStarAnimator;