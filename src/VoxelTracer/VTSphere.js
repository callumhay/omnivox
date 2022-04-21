import * as THREE from 'three';
import VoxelConstants from '../VoxelConstants';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTTransformable from './VTTransformable';

export const defaultSphereOptions = {
  samplesPerVoxel: 6,
  fill: false,
  castsShadows: true,
  receivesShadows: true,
};

const _sphere = new THREE.Sphere();
const _zeroVec = new THREE.Vector3(0,0,0);

class VTSphere extends VTTransformable {

  constructor(center, radius, material, options={...defaultSphereOptions}) {
    super(VTConstants.SPHERE_TYPE);
    
    this.position.copy(center);
    this._radius = radius;

    this._material = material;
    this._options = options;

    this.makeDirty();
  }

  getBoundingSphere(target) { target.set(_zeroVec, this._radius); target.applyMatrix4(this.matrixWorld); }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }
  get center() { return this.position; }
  get radius() { return this._radius; }
  set radius(r) { this._radius = r; this.makeDirty(); }

  toJSON() {
    const {id, drawOrder, type, _material, _options} = this;

    _sphere.set(_zeroVec, this._radius);
    _sphere.applyMatrix4(this.matrixWorld);
    const {center, radius} = _sphere;

    return {id, drawOrder, type, center, radius, material: _material, options: _options};
  }

  getCollidingVoxels(voxelBoundingBox=null) {
    this.getBoundingSphere(_sphere)
    const {center, radius} = _sphere;

    return VoxelGeometryUtils.voxelSphereList(center, radius + VoxelConstants.VOXEL_EPSILON, true, voxelBoundingBox);
  }
}

export default VTSphere;
