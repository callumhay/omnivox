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
    this._objectsBuilt = false;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    if (!options) { return; }
    
    if (!this._objectsBuilt) {
      const {
        boxAlpha, boxFill, boxCastsShadows, boxReceivesShadows, 
        boxTranslation, boxRotation, boxScale,
        ambientLightColour, pointLight1Pos, pointLight1Colour, pointLightsAtten
      } = options;

      const size = VoxelConstants.VOXEL_GRID_SIZE;
      const halfSize = VoxelConstants.VOXEL_HALF_GRID_UNIT;

      this.box1 = new VTBox(
        new THREE.Vector3(boxTranslation.x,boxTranslation.y,boxTranslation.z), new THREE.Vector3(4,4,4),
        new VTLambertMaterial(new THREE.Color(1,1,1), new THREE.Color(0,0,0), boxAlpha), 
        {fill: boxFill, castsShadows: boxCastsShadows, receivesShadows: boxReceivesShadows}
      );
      this.box1.setRotationFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(boxRotation.x),  THREE.MathUtils.degToRad(boxRotation.y),  THREE.MathUtils.degToRad(boxRotation.z))
      );
      this.box1.scale.copy(boxScale);

      this.floorBox = new VTBox(
        new THREE.Vector3(halfSize, 1, halfSize), new THREE.Vector3(size, 2, size),
        new VTLambertMaterial(new THREE.Color(1,1,1)), 
        {fill: boxFill, castsShadows: true, receivesShadows: true}
      );
      this.ptLight1 = new VTPointLight(
        new THREE.Vector3(pointLight1Pos.x,pointLight1Pos.y,pointLight1Pos.z), 
        new THREE.Color(pointLight1Colour.r,pointLight1Colour.g,pointLight1Colour.b), 
        {...pointLightsAtten}, true
      );
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      this._objectsBuilt = true;
    }
    this.scene.addObject(this.ambientLight);
    this.scene.addObject(this.box1);
    this.scene.addObject(this.floorBox);
    this.scene.addObject(this.ptLight1);
  }

  async render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    await this.scene.render();
  }

}

export default BoxTestScene;