import * as THREE from 'three';

import VoxelAnimator, {DEFAULT_CROSSFADE_TIME_SECS} from './VoxelAnimator';
import {sceneAnimatorDefaultConfig, SCENE_TYPE_SIMPLE, SCENE_TYPE_SHADOW, SCENE_TYPE_FOG} from './SceneAnimatorDefaultConfigs';

import {clamp} from '../MathUtils';

import VoxelModel, {BLEND_MODE_ADDITIVE, BLEND_MODE_OVERWRITE} from '../Server/VoxelModel';

import SimpleScene from '../VoxelTracer/Scenes/SimpleScene';
import ShadowScene from '../VoxelTracer/Scenes/ShadowScene';
import FogScene from '../VoxelTracer/Scenes/FogScene';

class SceneAnimator extends VoxelAnimator {
  constructor(voxelModel, vtScene, config={...sceneAnimatorDefaultConfig}) {
    super(voxelModel, config);
    
    // Cross-fading variables
    this._totalCrossfadeTime = DEFAULT_CROSSFADE_TIME_SECS;
    this._crossfadeCounter = Infinity;
    this._prevSceneConfig = null;
    
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
        this._prevSceneConfig = this.config;
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

  rendersToCPUOnly() { return this._prevSceneConfig === null; }

  render(dt) {
    const currScene = this._sceneMap[this.config.sceneType];

    // Crossfade between scenes
    if (this._prevSceneConfig) {
      const prevScene = this._sceneMap[this._prevSceneConfig.sceneType];

      // Adjust the scene alphas as a percentage of the crossfade time and continue counting the total time until the crossfade is complete
      const percentFade = clamp(this._crossfadeCounter / this._totalCrossfadeTime, 0, 1);
      const prevSceneFBIdx = VoxelModel.CPU_FRAMEBUFFER_IDX_0;
      const currSceneFBIdx = VoxelModel.CPU_FRAMEBUFFER_IDX_1;

      // Rebuild and render the previous scene - this must be rendered into a CPU framebuffer
      prevScene.rebuild(this._prevSceneConfig.sceneOptions);
      this.voxelModel.setFramebuffer(prevSceneFBIdx);
      this.voxelModel.clear();
      prevScene.render(dt);

      if (this._crossfadeCounter < this._totalCrossfadeTime) {
        this._crossfadeCounter += dt;
      }
      else {
        // no longer crossfading, reset to just showing the current scene
        this._crossfadeCounter = Infinity;
        this._prevSceneConfig = null;
      }

      // Rebuild and render the current scene into a different CPU buffer from the previous scene
      currScene.rebuild(this.config.sceneOptions);
      this.voxelModel.setFramebuffer(currSceneFBIdx);
      this.voxelModel.clear();
      currScene.render(dt);

      // Now we set the default render framebuffer for the animator and we combine
      // the two scene framebuffers into it
      this.voxelModel.setFramebuffer(VoxelModel.GPU_FRAMEBUFFER_IDX_0);
      this.voxelModel.drawCombinedFramebuffers(
        currSceneFBIdx, prevSceneFBIdx, 
        {mode: VoxelModel.FB1_ALPHA_FB2_ONE_MINUS_ALPHA, alpha: percentFade}
      );
    }
    else {
      currScene.render(dt);
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