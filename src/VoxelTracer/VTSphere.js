import * as THREE from 'three';
import VoxelConstants from '../VoxelConstants';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTObject from './VTObject';

export class VTSphereAbstract extends VTObject {
  constructor(center, radius, material) {
    super(VTObject.SPHERE_TYPE);
    this._sphere = new THREE.Sphere(center, radius);
    this._material = material;

    // Temp variable for calculations
    this._tempVec3 = new THREE.Vector3();
  }

  dispose() { this._material.dispose(); }
  isShadowCaster() { return true; }

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

  constructor(center, radius, material) {
    super(center, radius, material);
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
    const {id, type, _sphere, _material} = this;
    const {center, radius} = _sphere;
    return {id, type, center, radius, material: _material};
  }

  intersectsBox(box) {
    return this._sphere.intersectsBox(box);
  }
}