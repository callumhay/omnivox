import * as THREE from 'three';
import VoxelConstants from '../VoxelConstants';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTObject from './VTObject';

export const defaultSphereOptions = {
  samplesPerVoxel: 6,
  fill: false,
  castsShadows: true,
  receivesShadows: true,
};

//const _sphere = new THREE.Sphere();
//const _zeroVec = new THREE.Vector3(0,0,0);

class VTSphere extends VTObject {

  constructor(center, radius, material, options={...defaultSphereOptions}) {
    super(VTConstants.SPHERE_TYPE);
    
    this._sphere = new THREE.Sphere(center, radius);

    //this.position.copy(center);
    //this._radius = radius;

    this._material = material;
    this._options = options;

    this.makeDirty();
  }

  getBoundingSphere() { return this._sphere; }
  //getBoundingSphere(target) { target.set(_zeroVec, this._radius); target.applyMatrix4(this.matrixWorld); }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }
  get center() { return this._sphere.center; }
  setCenter(c) { this._sphere.set(c, this._sphere.radius); this.makeDirty(); }
  get radius() { return this._sphere.radius; }
  setRadius(r) { this._sphere.set(this._sphere.center, r); this.makeDirty(); }

  toJSON() {
    const {id, drawOrder, type, _sphere, _material, _options} = this;
    const {center, radius} = _sphere;

    //_sphere.set(_zeroVec, this._radius);
    //_sphere.applyMatrix4(this.matrixWorld);
    //const {center, radius} = _sphere;

    return {id, drawOrder, type, center, radius, material: _material, options: _options};
  }

  getCollidingVoxels(voxelBoundingBox=null) {
    const {center, radius} = this._sphere;

    //this.getBoundingSphere(_sphere)
    //const {center, radius} = _sphere;

    return VoxelGeometryUtils.voxelSphereList(center, radius + VoxelConstants.VOXEL_EPSILON, true, voxelBoundingBox);
  }
}

export default VTSphere;
