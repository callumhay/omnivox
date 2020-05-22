
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
  }

  build() {
    if (!this._objectsBuilt) {
      const size = this.voxelModel.xSize();
      const halfXSize = this.voxelModel.xSize()/2;
      const halfYSize = this.voxelModel.ySize()/2;
      const halfZSize = this.voxelModel.zSize()/2;

      //this.sphereGeometry = new THREE.SphereBufferGeometry(1, 10, 10);
      //this.sphereGeometry.translate(halfXSize, size-1, halfZSize);
      //this.sphereMesh = new VTMesh(this.sphereGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));

      this.boxGeometry = new THREE.BoxBufferGeometry(3,3,3);
      this.boxGeometry.translate(halfXSize, halfYSize, halfZSize);
      this.boxMesh = new VTMesh(this.boxGeometry, new VTLambertMaterial(new THREE.Color(1,1,1)));

      this.ptLight1 = new VTPointLight(new THREE.Vector3(0, halfYSize, halfZSize), new THREE.Color(1,1,1), {quadratic:size, linear:0.5, constant:0.1});
      this.ptLight2 = new VTPointLight(new THREE.Vector3(halfXSize, halfYSize, 0), new THREE.Color(1,1,1), {quadratic:size, linear:0.5, constant:0.1});
      this.ptLight3 = new VTPointLight(new THREE.Vector3(halfXSize, 0, halfZSize), new THREE.Color(1,1,1), {quadratic:size, linear:0.5, constant:0.1});

      this.ambientLight = new VTAmbientLight(new THREE.Color(0.1,0.1,0.1));

      this._objectsBuilt = true;
    }

    this.scene.addLight(this.ptLight1);
    this.scene.addLight(this.ptLight2);
    this.scene.addLight(this.ptLight3);
    this.scene.addLight(this.ambientLight);
    //this.scene.addObject(this.sphereMesh);
    this.scene.addObject(this.boxMesh);
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    // Move lights around in circles...
    const RADIUS = halfXSize/2 - 1;
    const ANGULAR_VEL = Math.PI;
    const t = dt*ANGULAR_VEL;


    //this.sphereGeometry.translate((RADIUS)*Math.cos(t)+RADIUS, 0, (RADIUS)*Math.sin(t)+RADIUS)
    //this.sphereGeometry.computeBoundsTree();

    this.scene.render(dt);

    this.timeCounter += dt;
  }
}

export default ShadowScene;