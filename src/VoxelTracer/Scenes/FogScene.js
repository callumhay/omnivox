import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTAmbientLight from '../VTAmbientLight';
import VTPointLight from '../VTPointLight';
import VTSpotLight from '../VTSpotLight';
import {VTFogBox} from '../VTFog';

class FogScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    if (this.fog) { return; } // Already loaded?
    
    const size = this.voxelModel.xSize();

    this.ptLight = new VTPointLight();
    this.spotLight = new VTSpotLight(new THREE.Vector3(size/2, size-1, size/2), new THREE.Vector3(0,-1,0));
    this.fog = new VTFogBox(new THREE.Vector3(0,0,0), new THREE.Vector3(size, size, size));
    this.ambientLight = new VTAmbientLight();
    this.timeCounter = 0;
  }
  unload() {
    this.ptLight = null;
    this.spotLight = null;
    this.fog = null;
    this.ambientLight = null;
  }

  setOptions(options) {
    const {
      fogColour, fogScattering, ambientLightColour, 
      pointLightColour, pointLightAtten, spotLightAngles, spotLightAtten
    } = options;
    const {inner, outer} = spotLightAngles;

    this.ptLight.setColour(pointLightColour).setAttenuation(pointLightAtten);
    this.spotLight.setColour(pointLightColour)
      .setConeAngles(THREE.MathUtils.degToRad(inner), THREE.MathUtils.degToRad(outer))
      .setRangeAttenuation(spotLightAtten);
      
    this.fog.setColour(fogColour).setScattering(fogScattering);
    this.ambientLight.setColour(ambientLightColour);

    this.scene.addObject(this.ptLight);
    this.scene.addObject(this.spotLight);
    this.scene.addObject(this.fog);
    this.scene.addObject(this.ambientLight);
    
    super.setOptions(options);
  }

  async render(dt) {
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const lightMovementRadius = halfXSize-1;

    const t = this.timeCounter*Math.PI;
    this.ptLight.position.set(lightMovementRadius*Math.cos(t) + halfXSize, halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);
    this.ptLight.makeDirty();
    this.timeCounter += dt;

    await this.scene.render();
  }
}

export default FogScene;