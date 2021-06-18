import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTFog, { fogDefaultOptions } from '../VTFog';

class GodRayScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
    this._timeCounter = 0;
    this._shapePosition = new THREE.Vector3(voxelModel.xSize()/2, voxelModel.ySize()/2, voxelModel.zSize()/2);
    this._shapeRotation = new THREE.Euler(0,0,0);
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    const fogColour = options.fogColour ? options.fogColour : fogDefaultOptions.fogColour;
    const fogScattering = options.fogScattering ? options.fogScattering : fogDefaultOptions.fogScattering;
    const fogOptions = {
      fogColour: new THREE.Color(fogColour.r, fogColour.g, fogColour.b), 
      scattering: fogScattering
    };

    if (!this._objectsBuilt) {
      const size = this.voxelModel.xSize();
      this.fog = new VTFog(new THREE.Vector3(0,0,0), new THREE.Vector3(size, size, size), fogOptions);

      const {shapeSize, shapeColour, shapeEmission} = options;
      this.shapeGeom = new THREE.BoxBufferGeometry(shapeSize.x, shapeSize.y, shapeSize.z, 1, 1, 1);
      this.shapeMesh = new VTMesh(this.shapeGeom, new VTLambertMaterial(new THREE.Color(shapeColour.r, shapeColour.g, shapeColour.b), 
        new THREE.Color(shapeEmission.r, shapeEmission.g, shapeEmission.b)));
      this.shapeMesh.setPositionFromVec3(this._shapePosition);
      this.shapeMesh.setRotationFromEuler(this._shapeRotation);

      const pointLightColour = options.pointLightColour ? options.pointLightColour : {x:1,y:1,z:1};
      const pointLightPosition = /*this.ptLight ? this.ptLight.position : */(options.pointLightPosition ? options.pointLightPosition : {x:0,y:0,z:0});
      const pointLightAtten = options.pointLightAtten ? options.pointLightAtten : {quadratic:0.01, linear:0};
      
      this.ptLight = new VTPointLight(
        new THREE.Vector3(pointLightPosition.x, pointLightPosition.y, pointLightPosition.z), 
        new THREE.Color(pointLightColour.r, pointLightColour.g, pointLightColour.b), 
        {...pointLightAtten}
      );

      this._objectsBuilt = true;
    }
    else {
      this.fog.options = fogOptions;
    }

    this.scene.addObject(this.shapeMesh);
    this.scene.addLight(this.ptLight);
    this.scene.addFog(this.fog);
  }

  async render(dt) {
    if (!this._objectsBuilt) {
      return;
    }
    /*
    const tAngle = this._timeCounter*Math.PI;
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    const lightMovementRadius = halfXSize-1;
    this.ptLight.setPosition(this.ptLight.position.set(
      lightMovementRadius*Math.cos(tAngle) + halfXSize, halfYSize, lightMovementRadius*Math.sin(tAngle) + halfZSize)
    );
    */

    const {shapeRotationSpd} = this._options;
    const newRX = this._shapeRotation.x + dt*shapeRotationSpd.x;
    const newRY = this._shapeRotation.y + dt*shapeRotationSpd.y;
    const newRZ = this._shapeRotation.z + dt*shapeRotationSpd.z;
    this._shapeRotation.set(newRX, newRY, newRZ);
    this.shapeMesh.setRotationFromEuler(this._shapeRotation);

    //this._shapePosition ...

    this._timeCounter += dt;
    await this.scene.render();
  }

};

export default GodRayScene;