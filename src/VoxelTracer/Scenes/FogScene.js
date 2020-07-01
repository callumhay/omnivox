
import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';
import VTFog, { fogDefaultOptions } from '../VTFog';



class FogScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
    this.timeCounter = 0;
  }

  build(options) {

    const fogColour = options.fogColour ? options.fogColour : fogSceneDefaultOptions.fogColour;
    const fogScattering = options.fogScattering ? options.fogScattering : fogDefaultOptions.fogScattering;

    const fogOptions = {
      fogColour: new THREE.Color(fogColour.r, fogColour.g, fogColour.b).multiplyScalar(this.crossfadeAlpha), 
      scattering: fogScattering
    };

    if (!this._objectsBuilt) {
      const ambientLightColour = options.ambientLightColour ? options.ambientLightColour : fogSceneDefaultOptions.ambientLightColour;
      const pointLightColour = options.pointLightColour ? options.pointLightColour : fogSceneDefaultOptions.pointLightColour;
      const pointLightPosition = options.pointLightPosition ? options.pointLightPosition : fogSceneDefaultOptions.pointLightPosition;
      const pointLightAtten = options.pointLightAtten ? options.pointLightAtten : fogSceneDefaultOptions.pointLightAtten;

      this.timeCounter = 0;

      const size = this.voxelModel.xSize();
      //const halfXSize = this.voxelModel.xSize()/2;
      //const halfZSize = this.voxelModel.zSize()/2;

      this.ptLight = new VTPointLight(
        new THREE.Vector3(pointLightPosition.x, pointLightPosition.y, pointLightPosition.z), 
        new THREE.Color(pointLightColour.r, pointLightColour.g, pointLightColour.b).multiplyScalar(this.crossfadeAlpha), 
        {...pointLightAtten}
      );

      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b).multiplyScalar(this.crossfadeAlpha));
      this.fog = new VTFog(new THREE.Vector3(0,0,0), new THREE.Vector3(size, size, size), fogOptions);

      this._objectsBuilt = true;
    }
    else {
      this.fog.options = fogOptions;
    }

    this.scene.addLight(this.ptLight);
    this.scene.addLight(this.ambientLight);
    this.scene.addFog(this.fog);
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const lightMovementRadius = halfXSize-1;

    const t = this.timeCounter*Math.PI;

    this.ptLight.position.set(lightMovementRadius*Math.cos(t) + halfXSize, halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);

    this.scene.render();

    this.timeCounter += dt;
  }

  crossfade(alpha) {
    super.crossfade(alpha);

    const {fogColour, ambientLightColour, pointLightColour} = this._options;
    this.ptLight.colour.setRGB(pointLightColour.r, pointLightColour.g, pointLightColour.b).multiplyScalar(alpha);
    this.ambientLight.colour.setRGB(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b).multiplyScalar(alpha);
    this.fog.colour.setRGB(fogColour.r, fogColour.g, fogColour.b).multiplyScalar(alpha);
  }
}

export default FogScene;