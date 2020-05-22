
import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';

class SimpleScene extends SceneRenderer {
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
      this.sphereGeometry = new THREE.SphereBufferGeometry(2, 20, 20);
      this.sphereGeometry.translate(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);
      this.sphereMesh = new VTMesh(this.sphereGeometry, new VTLambertMaterial(new THREE.Color(1,1,1), null));
      this.ptLight1 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(1,0,0), {quadratic: 0, linear:3, constant:0});
      this.ptLight2 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(0,1,0), {quadratic: 0, linear:3, constant:0});
      this.ptLight3 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(0,0,1), {quadratic: 0, linear:3, constant:0});
      this.ambientLight = new VTAmbientLight(new THREE.Color(0.2,0.2,0.2));

      this._objectsBuilt = true;
    }

    this.scene.addLight(this.ptLight1);
    this.scene.addLight(this.ptLight2);
    this.scene.addLight(this.ptLight3);
    this.scene.addLight(this.ambientLight);
    this.scene.addObject(this.sphereMesh);
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    // Move lights around in circles...
    const RADIUS = this.voxelModel.xSize()/2;
    const ANGULAR_VEL = Math.PI;

    const t = this.timeCounter*ANGULAR_VEL;
    this.ptLight1.position.set((RADIUS-1)*Math.cos(t)+RADIUS, RADIUS, (RADIUS-1)*Math.sin(t)+RADIUS);
    this.ptLight2.position.set(RADIUS, (RADIUS-1)*Math.cos(t)+RADIUS, (RADIUS-1)*Math.sin(t)+RADIUS);
    this.ptLight3.position.set((RADIUS-1)*Math.sin(t)+RADIUS, (RADIUS-1)*Math.cos(t)+RADIUS, RADIUS);

    this.scene.render(dt);

    this.timeCounter += dt;
  }
}

export default SimpleScene;