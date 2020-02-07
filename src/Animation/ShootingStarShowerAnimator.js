import * as THREE from 'three';

import VoxelAnimator, {REPEAT_INFINITE_TIMES} from './VoxelAnimator';
import ShootingStarAnimator from './ShootingStarAnimator';
import {UniformVector3Randomizer, Vector3DirectionRandomizer} from './Randomizers';


const shootingStarShowerDefaultConfig = {
  positionRandomizer: new UniformVector3Randomizer(new THREE.Vector3(0,0,7), new THREE.Vector3(7,7,7)),
  directionRandomizer: new Vector3DirectionRandomizer(new THREE.Vector3(0,0,-1), 0, Math.PI/4.0),
  repeat: REPEAT_INFINITE_TIMES,
};

/**
 * This class can be thought of as a composition of many shooting stars with
 * lots of levers for randomness (where they appear, how fast they move, etc.).
 */
class ShootingStarShowerAnimator extends VoxelAnimator {
  constructor(voxels, config = shootingStarShowerDefaultConfig) {
    super(voxels, config);

    this.activeShootingStars = [];
  }

  animate(dt) {

  }
}

export default ShootingStarShowerAnimator;