import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import ShootingStarAnimator from './ShootingStarAnimator';





class ShootingStarShowerAnimator extends VoxelAnimator {
  constructor(voxels, config) {
    super(voxels, config);

    this.activeAnimators = [];
  }

  animate(dt) {

  }
}

export default ShootingStarShowerAnimator;