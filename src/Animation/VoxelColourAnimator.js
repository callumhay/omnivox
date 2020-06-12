import * as THREE from 'three';
import chroma from 'chroma-js';

import VoxelAnimator, {REPEAT_INFINITE_TIMES} from './VoxelAnimator';
import {COLOUR_INTERPOLATION_RGB} from '../Spectrum';

export const INTERPOLATION_LERP     = 'lerp';
export const INTERPOLATION_SMOOTH   = 'smooth';
export const INTERPOLATION_SMOOTHER = 'smoother';
export const INTERPOLATION_TYPES = [
  INTERPOLATION_LERP,
  INTERPOLATION_SMOOTH,
  INTERPOLATION_SMOOTHER,
];

export const voxelColourAnimatorDefaultConfig = {
  voxelPositions: [{x:0, y:0, z:0}],
  colourStart: {r:0, g:0, b:0},
  colourEnd: {r:1, g:1, b:1},
  colourInterpolationType: COLOUR_INTERPOLATION_RGB,
  interpolationType: INTERPOLATION_LERP,
  startTimeSecs: 0.0,
  endTimeSecs: 10.0,
  repeat: 0,
};

class VoxelColourAnimator extends VoxelAnimator {
  constructor(voxels, config = voxelColourAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR; }

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

  render(dt) {
    super.render(dt);

    const {startTimeSecs, endTimeSecs, colourInterpolationType, interpolationType} = this.config;

    let dtRemaining = dt;
    if (this.currTime >= startTimeSecs) {
      
      let interpolateAlpha = 0;
      switch (interpolationType) {
        default:
        case INTERPOLATION_LERP:
          interpolateAlpha = (this.currTime - startTimeSecs) / (endTimeSecs - startTimeSecs);
          break;
        case INTERPOLATION_SMOOTH:
          interpolateAlpha = THREE.MathUtils.smoothstep(this.currTime, startTimeSecs, endTimeSecs);
          break;
        case INTERPOLATION_SMOOTHER:
          interpolateAlpha = THREE.MathUtils.smootherstep(this.currTime, startTimeSecs, endTimeSecs);
          break;
      }
      
      const temp = chroma.mix(chroma.gl(this.colourStart), chroma.gl(this.colourEnd), interpolateAlpha, colourInterpolationType).gl();
      const currColour = new THREE.Color(temp[0], temp[1], temp[2]);

      this.voxelPositions.forEach(voxelPos => {
        this.voxelModel.setVoxel(voxelPos, currColour);
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