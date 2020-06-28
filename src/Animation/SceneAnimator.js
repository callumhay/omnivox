import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {sceneAnimatorDefaultConfig, SCENE_TYPE_SIMPLE, SCENE_TYPE_SHADOW, SCENE_TYPE_FOG} from './SceneAnimatorDefaultConfigs';

import SimpleScene from '../VoxelTracer/Scenes/SimpleScene';
import ShadowScene from '../VoxelTracer/Scenes/ShadowScene';
import FogScene from '../VoxelTracer/Scenes/FogScene';

class SceneAnimator extends VoxelAnimator {
  constructor(voxelModel, vtScene, config={...sceneAnimatorDefaultConfig}) {
    super(voxelModel, config);
    
    this._clearColour = new THREE.Color(0,0,0);
    this._scene = vtScene;
    this._sceneMap = {
      [SCENE_TYPE_SIMPLE]:  new SimpleScene(this._scene, this.voxelModel),
      [SCENE_TYPE_SHADOW]:  new ShadowScene(this._scene, this.voxelModel),
      [SCENE_TYPE_FOG]   :  new FogScene(this._scene, this.voxelModel),
    };

    this.setConfig(config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_SCENE; }

  setConfig(c) {
    super.setConfig(c);

    const {sceneType, sceneOptions} = c;
    if (this._sceneMap) {
      const currScene = this._sceneMap[sceneType];
      if (currScene) {
        currScene.rebuild(sceneOptions);
      }
      else {
        console.error("Invalid scene type: " + sceneType);
      }
    }
  }

  render(dt) {
    const currScene = this._sceneMap[this.config.sceneType];
    if (currScene) {
      this.voxelModel.clear(this._clearColour);
      currScene.render(dt);
    }
  }

  reset() {
    this._sceneMap.forEach(s => s.clear());
  }
}

export default SceneAnimator;