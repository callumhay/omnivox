import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTAmbientLight from '../VTAmbientLight';
import VTIsofield from '../VTIsofield';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';

const rainbow = [
  new THREE.Color(0xff0000),
  new THREE.Color(0xff7f00),
  new THREE.Color(0xffff00),
  new THREE.Color(0x00ff00),
  new THREE.Color(0x0000ff),
  new THREE.Color(0x4b0082),
  new THREE.Color(0x9400d3)
];

class MetaballScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    const size = this.voxelModel.xSize();
    this.isofield = new VTIsofield(size, new VTLambertMaterial());
    this.ambientLight = new VTAmbientLight();
    this.pointLight1 = new VTPointLight();
    this.timeCounter = 0;
  }
  unload() {
    this.isofield = null;
    this.ambientLight = null;
    this.pointLight1 = null;
  }

  setOptions(options) {
    const {showLights, pointLight1Pos, pointLightsAtten, materialColour, ambientLightColour, hasShadows} = options;

    this.isofield.material.colour.copy(materialColour);
    this.isofield.setOptions({receivesShadows: hasShadows, castsShadows: hasShadows});

    this.ambientLight.colour.copy(ambientLightColour);

    this.pointLight1.position.copy(pointLight1Pos);
    this.pointLight1.colour.setRGB(1,1,1);
    this.pointLight1.setAttenuation(pointLightsAtten);
    this.pointLight1.setDrawLight(showLights);

    this.scene.addObject(this.isofield);
    this.scene.addObject(this.ambientLight);
    this.scene.addObject(this.pointLight1);

    super.setOptions(options);
  }

  async render(dt) {
    const {speed} = this._options;
    this.timeCounter += dt * speed * 0.5;

    this._updateIsofield();
    
    await this.scene.render();
  }

  _updateIsofield() {
    const {
      wallX, wallY, wallZ, multiColours, numBlobs, blobSizeMultiplier, subtractAmt
    } = this._options;

    this.isofield.reset();

    const subtract = subtractAmt;
		const strength = blobSizeMultiplier / ((Math.sqrt(numBlobs) - 1) / 4.0 + 1);

    for (let i = 0; i < numBlobs; i++) {
      const ballX = (Math.sin(i + 1.26 * this.timeCounter * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5);
      const ballY = Math.abs(Math.cos(i + 1.12 * this.timeCounter * Math.cos(1.22 + 0.1424 * i))) * 0.77; // dip into the floor
      const ballZ = Math.cos(i + 1.32 * this.timeCounter * 0.1 * Math.sin((0.92 + 0.53 * i))) * 0.27 + 0.5;

      if (multiColours) {
        this.isofield.addMetaball(ballX, ballY, ballZ, strength, subtract, rainbow[ i % 7 ]);
      } 
      else {
        this.isofield.addMetaball(ballX, ballY, ballZ, strength, subtract);
      }
    }

    if (wallY) { this.isofield.addWallY(1, subtract); }
    if (wallZ) { this.isofield.addWallZ(1, subtract); }
    if (wallX) { this.isofield.addWallX(1, subtract); }
  }
}

export default MetaballScene;