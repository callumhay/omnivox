import * as THREE from 'three';
import VoxelAnimator from './VoxelAnimator';

export const voxelColourAnimatorDefaultConfig = {
  voxelPositions: [{x:0, y:0, z:0}],
  colourStart: {r:0, g:0, b:0},
  colourEnd: {r:1, g:1, b:1},
  startTimeSecs: 0.0,
  endTimeSecs: 10.0,
};

class VoxelColourAnimator extends VoxelAnimator {
  constructor(voxels, config = voxelColourAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  setConfig(c) {
    super.setConfig(c);
    const {voxelPositions, colourStart, colourEnd} = c;

    if (voxelPositions !== this.voxelPositions) {
      this.voxelPositions = voxelPositions.map(value => new THREE.Vector3(value.x, value.y, value.z));
    }
    if (colourStart !== this.colourStart) {
      this.colourStart = new THREE.Color(colourStart.r, colourStart.g, colourStart.b);
    }
    if (colourEnd !== this.colourEnd) {
      this.colourEnd = new THREE.Color(colourEnd.r, colourEnd.g, colourEnd.b);
    }
  }

  animate(dt) {
    super.animate(dt);

    const {startTimeSecs, endTimeSecs} = this.config;

    if (this.currTime >= startTimeSecs) {
      const lerpAlpha = (this.currTime - startTimeSecs) / (endTimeSecs - startTimeSecs);
      const currColour = this.colourStart.clone().lerp(this.colourEnd, lerpAlpha);
      this.voxelPositions.forEach(voxelPos => {
        this.voxels.setVoxel(voxelPos, currColour);
      });
      this.animationFinished = (this.currTime >= endTimeSecs);
    }

    this.currTime = Math.min(endTimeSecs, this.currTime + dt); // Clamp to the end time
  }

  reset() {
    super.reset();
    this.currTime = 0;
    this.animationFinished = false;
  }
}

export default VoxelColourAnimator;