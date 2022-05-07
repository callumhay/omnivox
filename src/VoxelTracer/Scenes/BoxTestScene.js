import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTBox from '../VTBox';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';

import VoxelConstants from '../../VoxelConstants';

class BoxTestScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    const size = this.voxelModel.gridSize;
    const halfSize = size/2;

    this.box1 = new VTBox(new THREE.Vector3(), new THREE.Vector3(4,4,4), new VTLambertMaterial());
    this.floorBox = new VTBox(
      new THREE.Vector3(halfSize, 1, halfSize), new THREE.Vector3(size, 2, size),
      new VTLambertMaterial(new THREE.Color(1,1,1)), {fill: true, castsShadows: true, receivesShadows: true}
    );
    this.ptLight1 = (new VTPointLight()).setDrawLight(true);
    this.ambientLight = new VTAmbientLight();
  }
  unload() {
    this.box1 = null;
    this.floorBox = null;
    this.ptLight1 = null;
    this.ambientLight = null;
  }

  setOptions(options) {
    const {
      boxAlpha, boxFill, boxCastsShadows, boxReceivesShadows, 
      boxTranslation, boxRotation, boxScale,
      ambientLightColour, pointLight1Pos, pointLight1Colour, pointLightsAtten
    } = options;

    this.box1.position.copy(boxTranslation);
    this.box1.material.alpha = boxAlpha;
    this.box1.setOptions({fill: boxFill, castsShadows: boxCastsShadows, receivesShadows: boxReceivesShadows});
    this.box1.setRotationFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(boxRotation.x),  THREE.MathUtils.degToRad(boxRotation.y),  THREE.MathUtils.degToRad(boxRotation.z))
    );
    this.box1.scale.copy(boxScale);
    this.floorBox.setOptions({fill: boxFill});
    this.ptLight1.setPosition(pointLight1Pos).setColour(pointLight1Colour).setAttenuation(pointLightsAtten);
    this.ambientLight.setColour(ambientLightColour);

    this.scene.addObject(this.ambientLight);
    this.scene.addObject(this.box1);
    this.scene.addObject(this.floorBox);
    this.scene.addObject(this.ptLight1);

    super.setOptions(options);
  }

  async render(dt) {
    await this.scene.render();
  }

}

export default BoxTestScene;