import VoxelAnimator from './VoxelAnimator';
import VTScene from '../VoxelTracer/VTScene';

const defaultSceneAnimatorConfig = {

};

class SceneAnimator extends VoxelAnimator {

  constructor(voxelModel, config=defaultSceneAnimatorConfig) {
    super(voxelModel, config);
    this.scene = new VTScene(voxelModel);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SCENE; }

  setConfig(c) {
    super.setConfig(c);
  }

  render(dt) {
    this.scene.render(dt);
  }

  reset() {}
}

export default SceneAnimator;