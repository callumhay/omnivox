import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {sceneAnimatorDefaultConfig, SCENE_TYPE_SIMPLE, SCENE_TYPE_SHADOW, SCENE_TYPE_FOG} from './SceneAnimatorDefaultConfigs';

import SimpleScene from '../VoxelTracer/Scenes/SimpleScene';
import ShadowScene from '../VoxelTracer/Scenes/ShadowScene';
import FogScene from '../VoxelTracer/Scenes/FogScene';

class SceneAnimator extends VoxelAnimator {
  constructor(voxelModel, vtScene, config={...sceneAnimatorDefaultConfig}) {
    super(voxelModel, config);
    
    // Cross-fading variables
    this._totalCrossfadeTime = 0.0;
    this._crossfadeCounter = Infinity;
    this._prevSceneType = null;

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
    // Check whether the scene type has changed
    if (this.config.sceneType !== c.sceneType) {
      if (this.config.sceneType) {
        // Crossfade between the previous scene and the new scene
        this._prevSceneType = this.config.sceneType;
        this._crossfadeCounter = 0;
      }
    }

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
    this.voxelModel.clear(this._clearColour);

    // Crossfade between scenes
    if (this._prevSceneType) {
      const prevScene = this._sceneMap[this._prevSceneType];

      if (this._crossfadeCounter < this._totalCrossfadeTime) {
        // We are currently crossfading. Adjust the scene alphas as a percentage of the
        // crossfade time and continue counting the total time until the crossfade is complete
        const percentFade = this._crossfadeCounter / this._totalCrossfadeTime;
        prevScene.crossfade(1.0-percentFade);
        currScene.crossfade(percentFade);
        
        prevScene.render(dt);
        this._crossfadeCounter += dt;
      }
      else {
        // no longer crossfading, reset to just showing the current scene
        this._crossfadeCounter = Infinity;
        this._prevSceneType = null;
      }
    }

    currScene.render(dt);

    // Crossfade between animators
    if (this.crossfadeAlpha < 1) { 
      this.voxelModel.multiply(this.crossfadeAlpha);
    }

  }

  setCrossfadeTime(t) {
    this._totalCrossfadeTime = t;
  }

  reset() {
    this._sceneMap.forEach(s => s.clear());
  }
}

export default SceneAnimator;