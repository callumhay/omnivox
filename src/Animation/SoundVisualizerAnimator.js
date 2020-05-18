
import VoxelAnimator from "./VoxelAnimator";


class SoundVisualizerAnimator extends VoxelAnimator {
  constructor(voxelModel, config) {
    super(voxelModel, config);

    /*

    */

    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SOUND_VIZ; }

  setConfig(c) {
    super.setConfig(c);
  }

  render(dt) {
    /*
    if (this.mediaElement.paused) {
      this.mediaElement.play();
    }
    */

    
  }

  reset() {
    super.reset();
  }

  stop() {
    super.stop();
    //this.mediaElement.pause();
  }

}

export default SoundVisualizerAnimator;