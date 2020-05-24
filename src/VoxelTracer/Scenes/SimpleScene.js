
import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';

export const simpleSceneDefaultOptions = {
  sphereRadius: 2,
  pointLightsSpd: Math.PI/1.5,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLight1Colour: {r:1, g:0, b:0},
  pointLight2Colour: {r:0, g:1, b:0},
  pointLight3Colour: {r:0, g:0, b:1},
  pointLightAtten: {quadratic:0, linear:0},
};

class SimpleScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
  }

  static defaultOptions() { return simpleSceneDefaultOptions; }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    if (!this._objectsBuilt) {

      const {sphereRadius, ambientLightColour, pointLight1Colour, pointLight2Colour, pointLight3Colour, pointLightAtten} = options;

      this.sphereGeometry = new THREE.SphereBufferGeometry(sphereRadius, 20, 20);
      this.sphereGeometry.translate(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);
      this.sphereMesh = new VTMesh(this.sphereGeometry, new VTLambertMaterial(new THREE.Color(1,1,1), null));
      this.ptLight1 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight1Colour.r, pointLight1Colour.g, pointLight1Colour.b), {...pointLightAtten});
      this.ptLight2 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight2Colour.r, pointLight2Colour.g, pointLight2Colour.b), {...pointLightAtten});
      this.ptLight3 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight3Colour.r, pointLight3Colour.g, pointLight3Colour.b), {...pointLightAtten});
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

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

    const {pointLightsSpd} = this._options;

    // Move lights around in circles...
    const RADIUS = this.voxelModel.xSize()/2;

    const t = this.timeCounter*pointLightsSpd;
    this.ptLight1.position.set((RADIUS-1)*Math.cos(t)+RADIUS, RADIUS, (RADIUS-1)*Math.sin(t)+RADIUS);
    this.ptLight2.position.set(RADIUS, (RADIUS-1)*Math.cos(t)+RADIUS, (RADIUS-1)*Math.sin(t)+RADIUS);
    this.ptLight3.position.set((RADIUS-1)*Math.sin(t)+RADIUS, (RADIUS-1)*Math.cos(t)+RADIUS, RADIUS);

    this.scene.render(dt);

    this.timeCounter += dt;
  }
}

export default SimpleScene;