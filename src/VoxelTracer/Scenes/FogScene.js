import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTAmbientLight from '../VTAmbientLight';
import VTPointLight from '../VTPointLight';
import VTSpotLight from '../VTSpotLight';
import {VTFogBox, fogDefaultOptions } from '../VTFog';
import { MathUtils } from 'three';

class FogScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
    this.timeCounter = 0;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    const fogColour = options.fogColour ? options.fogColour : fogDefaultOptions.colour;
    const fogScattering = options.fogScattering ? options.fogScattering : fogDefaultOptions.fogScattering;
    const fogOptions = {
      colour: new THREE.Color(fogColour.r, fogColour.g, fogColour.b), 
      scattering: fogScattering
    };

    if (!this._objectsBuilt) {
      const ambientLightColour = options.ambientLightColour ? options.ambientLightColour : fogDefaultOptions.ambientLightColour;
      const pointLightColour = options.pointLightColour ? options.pointLightColour : fogDefaultOptions.pointLightColour;
      const pointLightAtten = options.pointLightAtten ? options.pointLightAtten : fogDefaultOptions.pointLightAtten;

      const size = this.voxelModel.xSize();

      this.ptLight = new VTPointLight(
        new THREE.Vector3(), new THREE.Color(pointLightColour.r, pointLightColour.g, pointLightColour.b), 
        {...pointLightAtten}
      );

      const {inner, outer} = options.spotLightAngles;
      const spotLightAtten = options.spotLightAtten ? options.spotLightAtten : fogDefaultOptions.pointLightAtten;
      this.spotLight = new VTSpotLight(
        new THREE.Vector3(size/2, size-1, size/2), new THREE.Vector3(0,-1,0),
        new THREE.Color(pointLightColour.r, pointLightColour.g, pointLightColour.b),
        MathUtils.degToRad(inner), MathUtils.degToRad(outer), {...spotLightAtten}
      );

      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));
      this.fog = new VTFogBox(new THREE.Vector3(0,0,0), new THREE.Vector3(size, size, size), fogOptions);

      this._objectsBuilt = true;
    }
    else {
      this.fog.options = fogOptions;
    }

    this.scene.addObject(this.ptLight);
    this.scene.addObject(this.spotLight);
    this.scene.addObject(this.ambientLight);
    this.scene.addObject(this.fog);
  }

  async render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const lightMovementRadius = halfXSize-1;

    const t = this.timeCounter*Math.PI;

    this.ptLight.setPosition(this.ptLight.position.set(lightMovementRadius*Math.cos(t) + halfXSize, halfYSize, lightMovementRadius*Math.sin(t) + halfZSize));

    this.timeCounter += dt;

    await this.scene.render();
  }
}

export default FogScene;