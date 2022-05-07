import * as THREE from 'three';
import InitUtils from '../InitUtils';
import VoxelConstants from '../VoxelConstants';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTMaterialFactory from './VTMaterialFactory';
import VTTransformable from './VTTransformable';

export const defaultBoxOptions = {
  samplesPerVoxel: 4,
  fill: false,
  castsShadows: true,
  receivesShadows: true,
};

const _box = new THREE.Box3();

class VTBox extends VTTransformable {
  constructor(center, size, material, options) {
    super(VTConstants.BOX_TYPE);

    if (center) { this.position.copy(center); }
    this.invMatrixWorld = this.matrixWorld.clone();

    this._max = new THREE.Vector3();
    this._min = new THREE.Vector3();
    this.setSize(InitUtils.initValue(size, 1));
    
    this._material = VTMaterialFactory.initMaterial(material);
    this._options  = options ? {...defaultBoxOptions, ...options} : {...defaultBoxOptions};
  }

  unDirty() {
    if (super.unDirty()) {
      this.invMatrixWorld.copy(this.matrixWorld).invert();
      return true;
    }
    return false;
  }

  get center() { return this.position; }
  setCenter(c) { this.position.copy(c); this.makeDirty(); return this; }

  setSize(s) { 
    this._max.copy(s).multiplyScalar(0.5);
    this._min.set(0,0,0).sub(this._max);
    this.makeDirty();
    return this;
  }
  getSize(target) {
    return target.copy(this._max).sub(this._min);
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); return this; }

  setOptions(o) { this._options = {...this._options, ...o}; this.makeDirty(); return this; }

  toJSON() {
    const {id, drawOrder, type, matrixWorld, invMatrixWorld, _min, _max, _material, _options} = this;
    return {
      id, drawOrder, type, min: _min, max: _max, 
      matrixWorld: matrixWorld.toArray(), invMatrixWorld: invMatrixWorld.toArray(),
      material: _material, options: _options
    };
  }

  getCollidingVoxels(voxelBoundingBox) {
    // Draw a box around the world transformed box, make sure it encompases all the
    // points with some margin of voxel sampling error
    _box.set(this._min, this._max);
    _box.applyMatrix4(this.matrixWorld);
    //_box.expandByScalar(VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS);
    //_box.min.roundToZero();
    //_box.max.roundToZero();

    // Get the box points inside the worldspace AABB
    return VoxelGeometryUtils.voxelAABBList(_box.min, _box.max, true, voxelBoundingBox);
  }
}

export default VTBox;