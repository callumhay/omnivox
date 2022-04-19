import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTObject from "./VTObject";

export const defaultBoxOptions = {
  samplesPerVoxel: 4,
  fill: false,
  castsShadows: true,
  receivesShadows: true,
};

class VTBox extends VTObject {
  constructor(center, size, material, options={...defaultBoxOptions}) {
    super(VTConstants.BOX_TYPE);

    size.multiplyScalar(0.5);
    this._min = center.clone().sub(size);
    this._max = center.add(size);
    this._localRotation = new THREE.Euler(0,0,0);
    this._material = material;
    this._options  = options;

    this.makeDirty();
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }

  get localRotationEuler() { return this._localRotation; }
  setLocalRotationEuler(r) { this._localRotation = r; this.makeDirty(); }

  toJSON() {
    const {id, drawOrder, type, _min, _max, _material, _options} = this;
    return {id, drawOrder, type, min: _min, max: _max, material: _material, options: _options};
  }

  getCollidingVoxels(voxelBoundingBox) {
    return VoxelGeometryUtils.voxelBoxListMinMax(this._min, this._max, this._localRotation, true, voxelBoundingBox);
  }
}

export default VTBox;