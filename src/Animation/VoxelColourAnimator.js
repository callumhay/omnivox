import * as THREE from 'three';
import VoxelAnimator, {REPEAT_INFINITE_TIMES} from './VoxelAnimator';

export const COLOUR_INTERPOLATION_HSL = 0;
export const COLOUR_INTERPOLATION_RGB = 1;

export const voxelColourAnimatorDefaultConfig = {
  voxelPositions: [{x:0, y:0, z:0}],
  colourStart: {r:0, g:0, b:0},
  colourEnd: {r:1, g:1, b:1},
  colourInterpolationType: COLOUR_INTERPOLATION_HSL,
  startTimeSecs: 0.0,
  endTimeSecs: 10.0,
  repeat: 0,
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

    const {startTimeSecs, endTimeSecs, colourInterpolationType} = this.config;

    let dtRemaining = dt;
    if (this.currTime >= startTimeSecs) {
      const lerpAlpha = (this.currTime - startTimeSecs) / (endTimeSecs - startTimeSecs);
      const currColour = this.colourStart.clone();
      
      switch (colourInterpolationType) {
        default:
        case COLOUR_INTERPOLATION_HSL:
          currColour.lerpHSL(this.colourEnd, lerpAlpha);
          break;
        case COLOUR_INTERPOLATION_RGB:
          currColour.lerp(this.colourEnd, lerpAlpha);
          break;
      }

      this.voxelPositions.forEach(voxelPos => {
        this.voxels.setVoxel(voxelPos, currColour);
      });

      const isFinishedCurrentLoop = (this.currTime >= endTimeSecs);
      if (isFinishedCurrentLoop) {
        this.incrementPlayCounter();
        if (this.repeat !== REPEAT_INFINITE_TIMES && this.getPlayCounter() >= this.repeat) {
          this.animationFinished = true;
        }
        else {
          // Find out how much time spilled over into the next animation before resetting the loop
          dtRemaining = dt - (endTimeSecs - this.currTime);
          this.resetLoop();
        }
      }
    }

    this.currTime = Math.min(endTimeSecs, this.currTime + dtRemaining); // Clamp to the end time
  }

  reset() {
    super.reset();
    this.resetLoop();
    this.animationFinished = false;
  }

  resetLoop() {
    this.currTime = 0;
  }
}

export default VoxelColourAnimator;