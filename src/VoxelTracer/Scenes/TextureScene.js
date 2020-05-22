import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTTexture from '../VTTexture';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';

class TextureScene extends SceneRenderer {
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
      this.sphereGeometry = new THREE.SphereBufferGeometry(2, 10, 10);
      this.sphereGeometry.translate(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);

      this.sphereTexture = new VTTexture("dist/textures/uv_test_grid.jpg");

      this.sphereMesh = new VTMesh(this.sphereGeometry, new VTLambertMaterial(new THREE.Color(1,1,1), this.sphereTexture));
      this.ptLight = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(1,1,1), {quadratic: 0, linear:2, constant:0});
      this.ambientLight = new VTAmbientLight(new THREE.Color(0.1,0.1,0.1));

      this._objectsBuilt = true;
    }

    this.scene.addLight(this.ptLight);
    this.scene.addLight(this.ambientLight);
    this.scene.addObject(this.sphereMesh);
  }

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    // Move lights around in circles...
    const RADIUS = this.voxelModel.xSize()/2;
    const ANGULAR_VEL = Math.PI/3;

    const t = this.timeCounter*ANGULAR_VEL;
    this.ptLight.position.set((RADIUS-1)*Math.cos(t)+RADIUS, RADIUS, (RADIUS-1)*Math.sin(t)+RADIUS);

    this.scene.render(dt);

    this.timeCounter += dt;
  }
}

export default TextureScene;