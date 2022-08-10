import VoxelAnimator from "./VoxelAnimator";


export const depthAnimatorDefaultConfig = {
};

class DepthBufferAnimator extends VoxelAnimator {
  constructor(voxelModel, config=depthAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_DEPTH; }

  load() {
    super.load();
    const {gridSize, gpuKernelMgr} = this.voxelModel;
    gpuKernelMgr.initDepthBufferKernels(gridSize);
  }
  unload() {
    super.unload();
    this.currDepthBufData = null;
  }
  reset() {
    super.reset();
    this.currDepthBufData = null;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; }
  }

  rendersToCPUOnly() { return false; }

  render(dt) {
    

  }

  // Called everytime the client updates the depth buffer
  updateClientFramebufferSlice(width, height, depthBuffer) {
    this.currDepthBufData = {width, height, depthBuffer};
  }

}

export default DepthBufferAnimator;