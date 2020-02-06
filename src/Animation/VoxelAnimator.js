
class VoxelAnimator {
  constructor(voxels, config) {
    this.voxels = voxels;
    this.setConfig(config);
  }

  setConfig(c) {
    this.config = c;
  }

  animate(dt) {
  }

  reset() {
  }
}

export default VoxelAnimator;