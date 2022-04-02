import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import {defaultSphereOptions, VTSphere} from '../VTSphere';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';

class ShadowScene extends SceneRenderer {
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
    if (!this._objectsBuilt) {
      const {movingBoxSize, ambientLightColour, pointLightColour, pointLightPosition, pointLightAtten, sphereFill} = options;

      const size = this.voxelModel.xSize();
      const halfXSize = this.voxelModel.xSize()/2;
      const halfZSize = this.voxelModel.zSize()/2;

      this.movingBoxGeometry = new THREE.BoxBufferGeometry(movingBoxSize.x, movingBoxSize.y, movingBoxSize.z, 1, 1, 1);
      this.movingBoxMesh = new VTMesh(this.movingBoxGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));

      this.boxGeometry = new THREE.BoxBufferGeometry(size,2,size);
      this.boxMesh = new VTMesh(this.boxGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));
      this.boxMesh.setPosition(halfXSize, size-1, halfZSize);

      this.sphere = new VTSphere(
        new THREE.Vector3(halfXSize-0.5, halfXSize-0.5, halfXSize-0.5), 
        3.0, new VTLambertMaterial(new THREE.Color(1,1,1)),
        {...defaultSphereOptions, fill: sphereFill}
      );

      this.ptLight = new VTPointLight(
        new THREE.Vector3(pointLightPosition.x, pointLightPosition.y, pointLightPosition.z), 
        new THREE.Color(pointLightColour.r, pointLightColour.g, pointLightColour.b), 
        {...pointLightAtten}
      );

      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      this._objectsBuilt = true;
    }
    const {sphereRadius} = options;
    this.sphere.setRadius(sphereRadius);

    this.scene.addLight(this.ptLight);
    this.scene.addObject(this.movingBoxMesh);
    this.scene.addObject(this.boxMesh);
    this.scene.addObject(this.sphere);
    this.scene.addLight(this.ambientLight);
  }

  async render(dt) {
    if (!this._objectsBuilt) {
      return;
    }
    const {movingBoxSpeed, sphereSpeed} = this._options;

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const RADIUS = halfXSize-2;

    const tBox = this.timeCounter*movingBoxSpeed;
    const tSphere = Math.PI + this.timeCounter*sphereSpeed;

    this.movingBoxMesh.setPosition((RADIUS)*Math.cos(tBox) + halfXSize, halfYSize-1, (RADIUS)*Math.sin(tBox) + halfZSize);
    this.sphere.setCenter(new THREE.Vector3((RADIUS)*Math.cos(tSphere) + halfXSize, halfYSize-1, (RADIUS)*Math.sin(tSphere) + halfZSize));
    this.movingBoxMesh.setRotationFromEuler(new THREE.Euler(0, tBox/10.0, 0));
    this.timeCounter += dt;

    await this.scene.render();
  }
}

export default ShadowScene;