import VideoAnimator from "./VideoAnimator";

export const doomAnimatorDefaultConfig = {
  movingFramebuffer: true,
  fps: 35, // The original Doom game logic was timed to 35 fps – we can update faster or slower, but this is a fun default
};

class DoomAnimator extends VideoAnimator {
  constructor(voxelModel, config=doomAnimatorDefaultConfig) {
    super(voxelModel, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_DOOM; }

  load() {
    super.load();
  }
  unload() {
    super.unload();
  }
  reset() {
    super.reset();
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; }
  }

  render(dt) {
    super.render(dt);
  }

  // Called everytime the client updates the framebuffer slice that represents a frame of the game
  updateClientFramebufferSlice(width, height, rgbaBuffer) {
    super.updateClientFramebufferSlice(width, height, rgbaBuffer);
  }
}

export default DoomAnimator;
