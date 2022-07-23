import VoxelAnimator from "./VoxelAnimator";

export const doomAnimatorDefaultConfig = {
  movingFramebuffer: true,
  fps: 35, // The original Doom game logic was timed to 35 fps – we can update faster or slower, but this is a fun default
};

class DoomAnimator extends VoxelAnimator {
  constructor(voxelModel, config=doomAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_DOOM; }

  load() {
    super.load();
    const {gridSize, gpuKernelMgr} = this.voxelModel;
    gpuKernelMgr.initGameFBKernels(gridSize);
    if (!this.gameFrameTex) {
      this.gameFrameTex = gpuKernelMgr.initGameFBBuffer4Func(0,0,0);
    }
    this.timeCounter = 0;
  }
  unload() {
    super.unload();
    if (this.gameFrameTex) {
      this.gameFrameTex.delete();
      this.gameFrameTex = null;
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
    if (!this.gameFrameTex) { return; }
    const {framebuffer, gpuKernelMgr} = this.voxelModel;

    // If there's no framebuffer data from the game then just copy the current collection of
    // gameframes to the current framebuffer and get out of here
    if (!this.currFramebufData) {
      framebuffer.setBufferTexture(gpuKernelMgr.copyFramebufferFunc(this.gameFrameTex));
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
        const newGameFrameTex = gpuKernelMgr.insertRGBAIntoFBKernel(this.gameFrameTex, width, height, rgbaBuffer);
        this.gameFrameTex.delete();
        this.gameFrameTex = newGameFrameTex;
        this.timeCounter -= spf;
      }
      framebuffer.setBufferTexture(gpuKernelMgr.copyFramebufferFunc(this.gameFrameTex));
    }
    else {
      framebuffer.setBufferTexture(gpuKernelMgr.singleSliceRGBAIntoFBKernel(width, height, rgbaBuffer));
    }
  }

  // Called everytime the client updates the framebuffer slice that represents a frame of the game
  updateClientFramebufferSlice(width, height, rgbaBuffer) {
    this.currFramebufData = {width, height, rgbaBuffer};
  }
}

export default DoomAnimator;
