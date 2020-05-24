import * as THREE from 'three';
import fs from 'fs';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTTexture from '../VTTexture';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';

export const textureSceneDefaultOptions = {
  sphereRadius: 2,
  pointLightMovementRadius: 4,
  pointLightsSpd: Math.PI/3,
  ambientLightColour: {r:0.1, g:0.1, b:0.1},
  pointLightColour: {r:1, g:1, b:1},
  pointLightAtten: {quadratic:0, linear:0},
  textureFilename: "uv_test_grid.jpg",
};

class TextureScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
  }

  static defaultOptions() { return textureSceneDefaultOptions; }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    if (!this._objectsBuilt) {
      const {sphereRadius, ambientLightColour, pointLightColour, pointLightAtten, textureFilepath} = options;

      this.sphereGeometry = new THREE.SphereBufferGeometry(sphereRadius, 10, 10);
      this.sphereGeometry.translate(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);

      let textureFileToUse = "dist/textures/uv_test_grid.jpg";
      if (fs.existsSync("dist/textures/" + textureFilepath)) {
        textureFileToUse = textureFilepath;
      }
      this.sphereTexture = new VTTexture(textureFileToUse);

      this.sphereMesh = new VTMesh(this.sphereGeometry, new VTLambertMaterial(new THREE.Color(1,1,1), this.sphereTexture));
      this.ptLight = new VTPointLight(
        new THREE.Vector3(0,0,0), 
        new THREE.Color(pointLightColour.r, pointLightColour.g, pointLightColour.b), 
        {...pointLightAtten}
      );
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

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

    const {pointLightMovementRadius, pointLightsSpd} = this._options;

    // Move lights around in circles...
    const centerX = this.voxelModel.xSize()/2;
    const centerY = this.voxelModel.ySize()/2;
    const centerZ = this.voxelModel.zSize()/2;

    const t = this.timeCounter*pointLightsSpd;
    this.ptLight.position.set(pointLightMovementRadius*Math.cos(t) + centerX, centerY, pointLightMovementRadius*Math.sin(t) + centerZ);

    this.scene.render(dt);

    this.timeCounter += dt;
  }
}

export default TextureScene;