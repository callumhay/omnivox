import * as THREE from 'three';

import VoxelGeometryUtils from '../../VoxelGeometryUtils';

import VTConstants from '../VTConstants';
import VTMaterialFactory from '../VTMaterialFactory';
import {defaultVTVoxelOptions} from '../VTVoxel';

import VTRPObject from './VTRPObject';
import VTRPObjectFactory from './VTRPObjectFactory';

const _tempVec3 = new THREE.Vector3();

class VTRPVoxel extends VTRPObject  {
  constructor() {
    super(VTConstants.VOXEL_TYPE);
    this._position = new THREE.Vector3();
    this._material = null;
    this._options  = {...defaultVTVoxelOptions};
    this._boundingBox = new THREE.Box3();
  }

  reinitBoundingBox() {
    VoxelGeometryUtils.singleVoxelBoundingBox(this._boundingBox, this._position);
  }

  expire(pool) {
    if (this._material) {
      pool.expire(this._material);
      this._material = null;
    }
  }

  fromJSON(json, pool) {
    const {id, drawOrder, _position, _material, _options} = json;
    this.id = id;
    this.drawOrder = drawOrder;
    this._position.copy(_position);
    this._options = {...this._options, ..._options};
    this._material = VTRPObjectFactory.updateOrBuildFromPool(_material, pool, this._material);
    this.reinitBoundingBox();
    return this;
  }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }

  intersectsRay(raycaster) { return raycaster.ray.intersectsBox(this._boundingBox, _tempVec3) !== null; }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster() && this.intersectsRay(raycaster),
      lightReduction: this._material.alpha, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    // Fast-out if we can't even see this voxel
    if (!this._material.isVisible() || !scene.voxelBoundingBox.containsPoint(this._position)) { return targetRGBA; }
    return scene.calculateVoxelLighting(targetRGBA, voxelIdxPt, this._position, this._material, this.isShadowReceiver());
  }
}

export default VTRPVoxel;