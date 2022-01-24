import * as THREE from 'three';

import VoxelAnimator, {REPEAT_INFINITE_TIMES} from './VoxelAnimator';
import VoxelColourAnimator, {INTERPOLATION_SMOOTHER, VOXEL_COLOUR_SHAPE_TYPE_POINT} from './VoxelColourAnimator';
import {COLOUR_INTERPOLATION_LRGB} from '../Spectrum';
import VoxelConstants from '../VoxelConstants';

export const shootingStarAnimatorDefaultConfig = {
  colour: {r:1, g:1, b:1},
  startPosition: {x:0, y:0, z:VoxelConstants.VOXEL_GRID_MAX_IDX},
  velocity: {x:5, y:0, z:0},
  fadeTimeSecs: 0.75,
  repeat: -1,
};

const tempVec3 = new THREE.Vector3();

/**
 * The ShootingStarAnimator will animate a single "shooting star", a voxel
 * that has a tail which moves from a given starting position in a given
 * direction until it has left the display.
 */
class ShootingStarAnimator extends VoxelAnimator {
  constructor(voxels, config = shootingStarAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_SHOOTING_STAR; }

  setConfig(c) {
    super.setConfig(c);
    const {startPosition, velocity} = c;

    if (startPosition !== this.startPosition) {
      this.startPosition = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    }
    if (startPosition !== this.currPosition) {
      this.currPosition = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    }
    if (velocity !== this.velocity) {
      this.velocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    }
  }

  addPositionToAnimatorMap(pos) {
    // The animator map cannot be longer than the longest sequence of voxels in the cube
    if (this.currAnimatorMap.length >= Math.ceil(VoxelConstants.VOXEL_DIAGONAL_GRID_SIZE)) { return false; }

    // Check to see if the current position has an animator yet...
    for (let i = 0; i < this.currAnimatorMap.length; i++) {
      if (this.currAnimatorMap[i].voxelPosition.distanceToSquared(pos) < VoxelConstants.VOXEL_ERR_UNITS) {
        return false;
      }
    }

    const {colour, fadeTimeSecs} = this.config;

    // No animator exists for the given position / voxel, create one.
    this.currAnimatorMap.push({
      voxelPosition: pos,
      animator: new VoxelColourAnimator(this.voxelModel, {
        shapeType: VOXEL_COLOUR_SHAPE_TYPE_POINT,
        pointProperties: {point: pos},
        colourStart: colour,
        colourEnd: {r:0, g:0, b:0},
        startTimeSecs: 0.0,
        endTimeSecs: fadeTimeSecs,
        interpolation: INTERPOLATION_SMOOTHER,
        colourInterpolationType: COLOUR_INTERPOLATION_LRGB,
      }),
    });

    return true;
  }

  rendersToCPUOnly() { return true; }

  render(dt) {
    if (this.animationFinished) {
      return;
    }

    super.render(dt);

    const roundedCurrPos = this.currPosition.clone().round();
    const currPosInBounds = this.voxelModel.isInBounds(this.currPosition);
    if (currPosInBounds) {
      this.addPositionToAnimatorMap(roundedCurrPos);
    }

    // Animate/tick the active animator objects
    this.currAnimatorMap.forEach((animatorObj) => {
      animatorObj.animator.render(dt);
    });

    // Clean up all finished animations (only keep the ones that haven't finished and are still in bounds)
    this.currAnimatorMap = this.currAnimatorMap.filter((animatorObj) => {
      return !animatorObj.animator.animationFinished && this.voxelModel.isInBounds(animatorObj.voxelPosition);
    });

    // Check to see whether this shooting star is finished: 
    // i.e., out of bounds, not heading towards the bounds, and has no animations left
    if (this.currAnimatorMap.length === 0 && !currPosInBounds) {

      const nVelocity = this.velocity.clone().normalize();
      const velocityRay = new THREE.Ray(this.currPosition, nVelocity);
      const voxelsBox = this.voxelModel.getBoundingBox();
      
      if (velocityRay.intersectBox(voxelsBox, tempVec3) === null) {
        // This loop has finished... check to see if there are repeats
        this.incrementPlayCounter();
        if (this.repeat !== REPEAT_INFINITE_TIMES && this.playCounter >= this.repeat) {
          this.animationFinished = true;
        }
        else {
          this.resetLoop();
        }
        return;
      }
    }

    const sampleStepSize = VoxelConstants.VOXEL_ERR_UNITS; // Sample at a reasonable enough rate
    const sqSampleStepSize = sampleStepSize * sampleStepSize;
    const incVelocity = this.velocity.clone().multiplyScalar(dt);
    const sqLenIncVel = incVelocity.lengthSq();

    // Perform sampling along the velocity addition in increments equal to a properly sized interval
    // to ensure we don't skip voxels
    if (sqLenIncVel > sqSampleStepSize && this.currAnimatorMap.length < Math.ceil(VoxelConstants.VOXEL_DIAGONAL_GRID_SIZE)) {
      const numSamples = Math.min(Math.floor(incVelocity.length() / sampleStepSize), 2*VoxelConstants.VOXEL_GRID_SIZE+1);
      const nVelocity = this.velocity.clone().normalize();
      for (let i = 1; i <= numSamples; i++) {
        const samplePos = this.currPosition.clone().add(nVelocity.clone().multiplyScalar(i*sampleStepSize));
        this.addPositionToAnimatorMap(samplePos.round());
      }
    }
    
    this.currPosition.add(incVelocity);
  }

  reset() {
    super.reset();
    this.resetLoop();
    this.currAnimatorMap = []; // An array of voxel positions to active animators
    this.animationFinished = false;
  }

  resetLoop() {
    this.currPosition.set(this.startPosition.x, this.startPosition.y, this.startPosition.z);
  }
};

export default ShootingStarAnimator;