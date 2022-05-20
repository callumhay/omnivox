import * as THREE from 'three';

import InitUtils from '../InitUtils';
import VoxelConstants from '../VoxelConstants';
import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTMaterialFactory from './VTMaterialFactory';
import VTTransformable from './VTTransformable';

export const defaultSphereOptions = {
  samplesPerVoxel: 6,
  fill: false,
  castsShadows: true,
  receivesShadows: true,
};

const _sphere  = new THREE.Sphere();
const _zeroVec = new THREE.Vector3(0,0,0);

class VTSphere extends VTTransformable {

  constructor(center, radius, material, options) {
    super(VTConstants.SPHERE_TYPE);
    
    if (center) { this.position.copy(center); }
    this._radius   = InitUtils.initValue(radius, 1);
    this._material = VTMaterialFactory.initMaterial(material);
    this._options  = options ? {...defaultSphereOptions, ...options} : {...defaultSphereOptions};
  }

  getBoundingSphere(target) { target.set(_zeroVec, this._radius); target.applyMatrix4(this.matrixWorld); }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); return this; }
  
  get center() { return this.position; }
  setCenter(c) { this.position.copy(c); this.makeDirty(); return this; }

  get radius() { return this._radius; }
  setRadius(r) { this._radius = r; this.makeDirty(); return this; }

  get options() { return this._options; }
  setOptions(o) { this._options = {...this._options, ...o}; this.makeDirty(); return this; }

  toJSON() {
    const {id, drawOrder, type, _material, _options} = this;
    this.getBoundingSphere(_sphere);
    const {center, radius} = _sphere;
    return {id, drawOrder, type, center, radius, material: _material, options: _options};
  }

  getCollidingVoxels(voxelBoundingBox=null) {
    this.getBoundingSphere(_sphere)
    const {center, radius} = _sphere;
    return VoxelGeometryUtils.voxelSphereList(center, radius + VoxelConstants.VOXEL_EPSILON, this._options.fill, voxelBoundingBox);
  }
}

export default VTSphere;
