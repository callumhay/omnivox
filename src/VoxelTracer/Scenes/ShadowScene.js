
import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';
import { simpleSceneDefaultOptions } from './SimpleScene';

export const shadowSceneDefaultOptions = {
  movingBoxSize: {x: 1.5, y:2, z:1.5},
  movingBoxSpeed: 1.5*Math.PI,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLightColour: {r:1, g:1, b:1},
  pointLightPosition: {x:4, y:0, z:4},
  pointLightAtten: {quadratic:0, linear:0},
};

class ShadowScene extends SceneRenderer {
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
    if (!this._objectsBuilt) {

      const movingBoxSize = options.movingBoxSize ? options.movingBoxSize : simpleSceneDefaultOptions.movingBoxSize;
      const ambientLightColour = options.ambientLightColour ? options.ambientLightColour : simpleSceneDefaultOptions.ambientLightColour;
      const pointLightColour = options.pointLightColour ? options.pointLightColour : simpleSceneDefaultOptions.pointLightColour;
      const pointLightPosition = options.pointLightPosition ? options.pointLightPosition : simpleSceneDefaultOptions.pointLightPosition;
      const pointLightAtten = options.pointLightAtten ? options.pointLightAtten : simpleSceneDefaultOptions.pointLightAtten;

      this.timeCounter = 0;

      const size = this.voxelModel.xSize();
      const halfXSize = this.voxelModel.xSize()/2;
      const halfZSize = this.voxelModel.zSize()/2;

      this.movingBoxGeometry = new THREE.BoxBufferGeometry(movingBoxSize.x, movingBoxSize.y, movingBoxSize.z, 1, 1, 1);
      this.movingBoxMesh = new VTMesh(this.movingBoxGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));

      this.boxGeometry = new THREE.BoxBufferGeometry(size,2,size);
      this.boxGeometry.translate(halfXSize, size-1, halfZSize);
      this.boxMesh = new VTMesh(this.boxGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));

      this.ptLight = new VTPointLight(
        new THREE.Vector3(pointLightPosition.x, pointLightPosition.y, pointLightPosition.z), 
        new THREE.Color(pointLightColour.r, pointLightColour.g, pointLightColour.b), 
        {...pointLightAtten}
      );

      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      this._objectsBuilt = true;
    }

    this.scene.addLight(this.ptLight);
    this.scene.addObject(this.movingBoxMesh);
    this.scene.addObject(this.boxMesh);
    this.scene.addLight(this.ambientLight);
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const movingBoxSpeed = this._options.movingBoxSpeed ? this._options.movingBoxSpeed : simpleSceneDefaultOptions.movingBoxSpeed;

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    // Move lights around in circles...
    const RADIUS = halfXSize-1.5;
    const t = this.timeCounter*movingBoxSpeed;

    this.movingBoxMesh.position.set((RADIUS)*Math.cos(t) + halfXSize, halfYSize-1, (RADIUS)*Math.sin(t) + halfZSize);
    this.movingBoxMesh.updateMatrixWorld();

    this.scene.render(dt);

    this.timeCounter += dt;
  }
}

export default ShadowScene;