
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

  build() {
    if (!this._objectsBuilt) {
      this.timeCounter = 0;

      const size = this.voxelModel.xSize();
      const halfXSize = this.voxelModel.xSize()/2;
      
      const halfZSize = this.voxelModel.zSize()/2;

      this.movingBoxGeometry = new THREE.BoxBufferGeometry(1.5, 2, 1.5, 1, 1, 1);
      this.movingBoxMesh = new VTMesh(this.movingBoxGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));

      this.boxGeometry = new THREE.BoxBufferGeometry(size,2,size);
      this.boxGeometry.translate(halfXSize, size-1, halfZSize);
      this.boxMesh = new VTMesh(this.boxGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));

      this.ptLight = new VTPointLight(new THREE.Vector3(halfXSize, 0, halfZSize), new THREE.Color(1,1,1), {quadratic:size*size, linear:1, constant:0});

      this.ambientLight = new VTAmbientLight(new THREE.Color(0.1,0.1,0.1));

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

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    // Move lights around in circles...
    const RADIUS = halfXSize-1.5;
    const ANGULAR_VEL = Math.PI/1.5;
    const t = this.timeCounter*ANGULAR_VEL;

    this.movingBoxMesh.position.set(Math.floor((RADIUS)*Math.cos(t) + halfXSize) , halfYSize-1, Math.floor((RADIUS)*Math.sin(t) + halfZSize));
    this.movingBoxMesh.updateMatrixWorld();

    this.scene.render(dt);

    this.timeCounter += dt;
  }
}

export default ShadowScene;