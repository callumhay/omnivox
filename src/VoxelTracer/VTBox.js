import * as THREE from 'three';
import VoxelConstants from '../VoxelConstants';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTTransformable from './VTTransformable';

export const defaultBoxOptions = {
  samplesPerVoxel: 4,
  fill: false,
  castsShadows: true,
  receivesShadows: true,
};

const _box = new THREE.Box3();

class VTBox extends VTTransformable {
  constructor(center, size, material, options={...defaultBoxOptions}) {
    super(VTConstants.BOX_TYPE);

    this.position.copy(center);

    size.multiplyScalar(0.5);
    this._min = (new THREE.Vector3()).sub(size);
    this._max = size;
    
    this._material = material;
    this._options  = options;

    this.makeDirty();
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }

  toJSON() {
    const {id, drawOrder, type, matrixWorld, _min, _max, _material, _options} = this;
    return {id, drawOrder, type, min: _min, max: _max, matrixWorld: matrixWorld.toArray(), material: _material, options: _options};
  }

  getCollidingVoxels(voxelBoundingBox) {
    // Draw a box around the world transformed box, make sure it encompases all the
    // points with some margin of voxel sampling error
    _box.set(this._min, this._max);
    _box.applyMatrix4(this.matrixWorld);
    _box.expandByScalar(VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS);
    _box.min.roundToZero();
    _box.max.roundToZero();

    // Get the box points inside the worldspace AABB
    return VoxelGeometryUtils.voxelAABBList(_box.min, _box.max, true, voxelBoundingBox);
  }
}

export default VTBox;