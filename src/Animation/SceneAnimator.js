import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import SimpleScene from '../VoxelTracer/Scenes/SimpleScene';
import VTScene from '../VoxelTracer/VTScene';
import ShadowScene, {shadowSceneDefaultOptions} from '../VoxelTracer/Scenes/ShadowScene';
import FogScene from '../VoxelTracer/Scenes/FogScene';

export const SCENE_TYPE_SIMPLE  = "Simple";
export const SCENE_TYPE_SHADOW  = "Shadow (Basic)";
export const SCENE_TYPE_FOG     = "Fog";

export const SCENE_TYPES = [
  SCENE_TYPE_SIMPLE,
  SCENE_TYPE_SHADOW,
  SCENE_TYPE_FOG,
];

export const sceneAnimatorDefaultConfig = {
  sceneType: SCENE_TYPE_SHADOW,
  sceneOptions: {...shadowSceneDefaultOptions},
};

class SceneAnimator extends VoxelAnimator {

  constructor(voxelModel, config={...sceneAnimatorDefaultConfig}) {
    super(voxelModel, config);
    this._clearColour = new THREE.Color(0,0,0);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SCENE; }

  setConfig(c) {
    //const prevScene = this.sceneMap ? this.sceneMap[this.config.sceneType] : null;
    super.setConfig(c);

    if (!this.scene) {
      this.scene = new VTScene(this.voxelModel);
      this.sceneMap = {
        [SCENE_TYPE_SIMPLE]:  new SimpleScene(this.scene, this.voxelModel),
        [SCENE_TYPE_SHADOW]:  new ShadowScene(this.scene, this.voxelModel),
        [SCENE_TYPE_FOG]   :  new FogScene(this.scene, this.voxelModel),
      };
    }

    const {sceneType, sceneOptions} = c;
    const currScene = this.sceneMap[sceneType];
    if (currScene) {
      currScene.rebuild(sceneOptions);
    }
    else {
      console.error("Invalid scene type: " + sceneType);
    }
  }

  render(dt) {
    const currScene = this.sceneMap[this.config.sceneType];
    if (currScene) {
      this.voxelModel.clear(this._clearColour);
      currScene.render(dt);
    }
  }

  reset() {
    this.sceneMap.forEach(s => s.clear());
  }
}

export default SceneAnimator;