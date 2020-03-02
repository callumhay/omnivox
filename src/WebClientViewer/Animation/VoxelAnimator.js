
export const REPEAT_INFINITE_TIMES = -1;

class VoxelAnimator {
  constructor(voxels, config) {
    this.voxels = voxels;
    this.repeat = 0;
    
    let _playCounter = 0;
    this.setPlayCounter = (val) => { _playCounter = val; };
    this.getPlayCounter = () => (_playCounter);
    this.incrementPlayCounter = () => { _playCounter++; };

    this.setConfig(config);
  }

  setConfig(c) {
    this.config = c;
    const {repeat} = c;
    if (repeat) {
      this.repeat = repeat;
    }
  }

  animate(dt) {
  }

  reset() {
    this.setPlayCounter(0);
  }
}

export default VoxelAnimator;