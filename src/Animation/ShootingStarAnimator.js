import * as THREE from 'three';

import VoxelAnimator, {REPEAT_INFINITE_TIMES} from './VoxelAnimator';
import VoxelColourAnimator, {INTERPOLATION_SMOOTHER} from './VoxelColourAnimator';

import {VOXEL_EPSILON, VOXEL_ERR_UNITS} from '../MathUtils';

export const shootingStarAnimatorDefaultConfig = {
  colour: {r:1, g:1, b:1},
  startPosition: {x:0, y:0, z:7},
  velocity: {x:5, y:0, z:0},
  fadeTimeSecs: 0.75,
  repeat: -1,
};

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
    const {colour, fadeTimeSecs} = this.config;

    // Check to see if the current position has an animator yet...
    for (let i = 0; i < this.currAnimatorMap.length; i++) {
      if (this.currAnimatorMap[i].voxelPosition.distanceToSquared(pos) < VOXEL_EPSILON) {
        return false;
      }
    }

    // No animator exists for the given position / voxel, create one.
    const animatorObj = {
      voxelPosition: pos,
      animator: new VoxelColourAnimator(this.voxels, {
        voxelPositions: [pos],
        colourStart: colour,
        colourEnd: {r:0, g:0, b:0},
        startTimeSecs: 0.0,
        endTimeSecs: fadeTimeSecs,
        interpolation: INTERPOLATION_SMOOTHER,
      }),
    };
    this.currAnimatorMap.push(animatorObj);

    return true;
  }

  render(dt) {
    if (this.animationFinished) {
      return;
    }

    super.render(dt);

    const roundedCurrPos = this.currPosition.clone().round();
    const currPosInBounds = this.voxels.isInBounds(this.currPosition);
    if (currPosInBounds) {
      this.addPositionToAnimatorMap(roundedCurrPos);
    }

    // Animate/tick the active animator objects
    this.currAnimatorMap.forEach((animatorObj) => {
      animatorObj.animator.render(dt);
    });

    // Clean up all finished animations (only keep the ones that haven't finished and are still in bounds)
    this.currAnimatorMap = this.currAnimatorMap.filter((animatorObj) => {
      return !animatorObj.animator.animationFinished && this.voxels.isInBounds(animatorObj.voxelPosition);
    });

    // Check to see whether this shooting star is finished: 
    // i.e., out of bounds, not heading towards the bounds, and has no animations left
    if (this.currAnimatorMap.length === 0 && !currPosInBounds) {

      const nVelocity = this.velocity.clone().normalize();
      const velocityRay = new THREE.Ray(this.currPosition, nVelocity);
      const voxelsBox = this.voxels.voxelDisplayBox();

      const target = new THREE.Vector3();
      if (velocityRay.intersectBox(voxelsBox, target) === null) {
        // This loop has finished... check to see if there are repeats
        this.incrementPlayCounter();
        if (this.repeat !== REPEAT_INFINITE_TIMES && this.getPlayCounter() >= this.repeat) {
          this.animationFinished = true;
        }
        else {
          this.resetLoop();
        }

        return;
      }
    }

    const sampleStepSize = VOXEL_ERR_UNITS; // Sample at a reasonable enough rate
    const sqSampleStepSize = sampleStepSize * sampleStepSize;
    const incVelocity = this.velocity.clone().multiplyScalar(dt);
    const sqLenIncVel = incVelocity.lengthSq();

    // Perform sampling along the velocity addition in increments equal to a properly sized interval
    // to ensure we don't skip voxels
    if (sqLenIncVel > sqSampleStepSize) {
      const numSamples = Math.floor(incVelocity.length() / sampleStepSize);
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