import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTMaterialFactory from './VTMaterialFactory';
import VTTransformable from './VTTransformable';

export const defaultVTVoxelOptions = {
  receivesShadows: true,
  castsShadows: true,
};

const _tempPos = new THREE.Vector3();

class VTVoxel extends VTTransformable  {
  constructor(position, material, options) {
    super(VTConstants.VOXEL_TYPE);

    if (position) { this.position.copy(position); }
    this._material = VTMaterialFactory.initMaterial(material);
    this._options = options ? {...defaultVTVoxelOptions, ...options} : {...defaultVTVoxelOptions};
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); return this; }

  setRadius(_) { return this; } // For compatibility with the particle emitter pipeline

  get options() { return this._options; }
  setOptions(o) { this._options = {...this._options, ...o}; this.makeDirty(); return this; }

  toJSON() {
    const {id, drawOrder, type, _material, _options} = this;
    this.getWorldPosition(_tempPos);
    return {id, drawOrder, type, _position:_tempPos, _material, _options};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    this.getWorldPosition(_tempPos); 
    const closestPt = VoxelGeometryUtils.closestVoxelIdxPt(_tempPos);
    return voxelGridBoundingBox.containsPoint(closestPt) ? [closestPt] : [];
  }
}

export default VTVoxel;
