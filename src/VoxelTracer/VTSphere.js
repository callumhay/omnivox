import * as THREE from 'three';
import VoxelConstants from '../VoxelConstants';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTObject from './VTObject';

export const defaultSphereOptions = {
  samplesPerVoxel: 6,
  fill: false,
  castsShadows: true,
};

export class VTSphereAbstract extends VTObject {
  constructor(center, radius, material, options) {
    super(VTObject.SPHERE_TYPE);
    this._sphere = new THREE.Sphere(center, radius);
    this._material = material;
    this._options = options;

    // Temp variable for calculations
    this._tempVec3 = new THREE.Vector3();
  }

  getBoundingSphere() { return this._sphere; }

  dispose() { this._material.dispose(); }
  isShadowCaster() { return this._options.castsShadows; }

  intersectsRay(raycaster) {
    this._sphere.radius -= VoxelConstants.VOXEL_EPSILON;
    const result = raycaster.ray.intersectSphere(this._sphere, this._tempVec3) !== null;
    this._sphere.radius += VoxelConstants.VOXEL_EPSILON;
    return result;
  }

  getCollidingVoxels(voxelBoundingBox=null) {
    const {center, radius} = this._sphere;
    return VoxelGeometryUtils.voxelSphereList(center, radius, true, voxelBoundingBox);
  }
}

export class VTSphere extends VTSphereAbstract {

  constructor(center, radius, material, options={...defaultSphereOptions}) {
    super(center, radius, material, options);
    this.makeDirty();
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }
  get center() { return this._sphere.center; }
  setCenter(c) { this._sphere.set(c, this._sphere.radius); this.makeDirty(); }
  get radius() { return this._sphere.radius; }
  setRadius(r) { this._sphere.set(this._sphere.center, r); this.makeDirty(); }

  isDirty() { return this._isDirty; }
  makeDirty() { this._isDirty = true; }
  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  toJSON() {
    const {id, drawOrder, type, _sphere, _material, _options} = this;
    const {center, radius} = _sphere;
    return {id, drawOrder, type, center, radius, material: _material, options: _options};
  }

  intersectsBox(box) {
    return this._sphere.intersectsBox(box);
  }
}