import VoxelAnimator from "./VoxelAnimator";

export const videoAnimatorDefaultConfig = {
  movingFramebuffer: true,
  fps: 30, // Typical video fps (for use when movingFramebuffer is true)
};

// Super class for displaying video as a set of 2D slices in Omnivox
class VideoAnimator extends VoxelAnimator {
  constructor(voxelModel, config=videoAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_VIDEO; }

  load() {
    super.load();
    const {gridSize, gpuKernelMgr} = this.voxelModel;
    gpuKernelMgr.initDisplayFramebufferSliceKernels(gridSize);
    if (!this.videoFrameTex) {
      this.videoFrameTex = gpuKernelMgr.initRGBFBBuffer4Func(0,0,0);
    }
    this.timeCounter = 0;
  }
  unload() {
    super.unload();
    if (this.videoFrameTex) {
      this.videoFrameTex.delete();
      this.videoFrameTex = null;
    }
    this.currFramebufData = null;
  }
  reset() {
    super.reset();
    this.timeCounter = 0;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; }
  }

  rendersToCPUOnly() { return false; }
  
  render(dt) {
    if (!this.videoFrameTex) { return; }
    const {framebuffer, gpuKernelMgr} = this.voxelModel;

    // If there's no framebuffer data from the game then just copy the current collection of
    // video frames to the current framebuffer and get out of here
    if (!this.currFramebufData) {
      framebuffer.setBufferTexture(gpuKernelMgr.copyFramebufferFunc(this.videoFrameTex));
      return;
    }
    this.timeCounter += dt;

    const {movingFramebuffer, fps} = this.config;
    const {width, height, rgbaBuffer} = this.currFramebufData;

    // The moving framebuffer causes each rendered slice to move through the voxel volume
    // giving a basic illusion of depth, it's a neat effect - otherwise just render a single slice
    // to one plane of the voxel grid
    if (movingFramebuffer) {
      const spf = 1/fps;
      if (this.timeCounter >= spf) {
        const newvideoFrameTex = gpuKernelMgr.insertRGBAIntoFBKernel(this.videoFrameTex, width, height, rgbaBuffer);
        this.videoFrameTex.delete();
        this.videoFrameTex = newvideoFrameTex;
        this.timeCounter -= spf;
      }
      framebuffer.setBufferTexture(gpuKernelMgr.copyFramebufferFunc(this.videoFrameTex));
    }
    else {
      framebuffer.setBufferTexture(gpuKernelMgr.singleSliceRGBAIntoFBKernel(width, height, rgbaBuffer));
    }
  }

  // Called everytime the client updates the framebuffer slice that represents a frame of the video
  updateClientFramebufferSlice(width, height, rgbaBuffer) {
    this.currFramebufData = {width, height, rgbaBuffer};
  }
}

export default VideoAnimator;
