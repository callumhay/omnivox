import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';



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

      const movingBoxSize = options.movingBoxSize ? options.movingBoxSize : shadowSceneDefaultOptions.movingBoxSize;
      const ambientLightColour = options.ambientLightColour ? options.ambientLightColour : shadowSceneDefaultOptions.ambientLightColour;
      const pointLightColour = options.pointLightColour ? options.pointLightColour : shadowSceneDefaultOptions.pointLightColour;
      const pointLightPosition = options.pointLightPosition ? options.pointLightPosition : shadowSceneDefaultOptions.pointLightPosition;
      const pointLightAtten = options.pointLightAtten ? options.pointLightAtten : shadowSceneDefaultOptions.pointLightAtten;

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

    const movingBoxSpeed = this._options.movingBoxSpeed ? this._options.movingBoxSpeed : shadowSceneDefaultOptions.movingBoxSpeed;

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const RADIUS = halfXSize-1.5;
    const t = this.timeCounter*movingBoxSpeed;
    this.movingBoxMesh.setPosition((RADIUS)*Math.cos(t) + halfXSize, halfYSize-1, (RADIUS)*Math.sin(t) + halfZSize);
    this.movingBoxMesh.updateMatrixWorld();

    this.scene.render();

    this.timeCounter += dt;
  }
}

export default ShadowScene;