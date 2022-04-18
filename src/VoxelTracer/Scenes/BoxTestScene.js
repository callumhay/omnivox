import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import {VTBox, defaultBoxOptions} from '../VTBox';
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
    if (!this._objectsBuilt) {
      const {boxFill, pointLight1Pos} = options;

      const halfSize = VoxelConstants.VOXEL_HALF_GRID_UNIT;

      this.box1 = new VTBox(
        new THREE.Vector3(halfSize,halfSize,halfSize), new THREE.Vector3(4,4,4),
        new VTLambertMaterial(new THREE.Color(1,1,1)), {...defaultBoxOptions, fill: boxFill}
      );
      this.ptLight1 = new VTPointLight(
        new THREE.Vector3(pointLight1Pos.x,pointLight1Pos.y,pointLight1Pos.z), 
        new THREE.Color(1,0,1), {quadratic:0.01, linear:0}, true
      );
      this.ambientLight = new VTAmbientLight(new THREE.Color(0, 0.25, 0));

      this._objectsBuilt = true;
    }
    this.scene.addObject(this.ambientLight);
    this.scene.addObject(this.box1);
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