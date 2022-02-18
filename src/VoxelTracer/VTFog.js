
import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';
import VTObject from './VTObject';

export const fogDefaultOptions = {
  scattering: 0.1, // The amount of light reduction per voxel travelled through of the fog this must be in [0,1]
  fogColour: new THREE.Color(1,1,1),
};

class VTFog extends VTObject {
  constructor(type, options) {
    super(type);
    this._colour = options.fogColour ? options.fogColour : fogDefaultOptions.fogColour;
    this._scattering = options.scattering ? options.scattering : fogDefaultOptions.scattering;
  }

  setColour(c) { this._colour = c; this.makeDirty(); }
  setScattering(s) {this._scattering = s; this.makeDirty(); }

  dispose() {}

  makeDirty() { this._isDirty = true; }
  isDirty() { return this._isDirty; }
  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  isShadowCaster() { return true; }

  toJSON() {
    const {id, type, _colour, _scattering} = this;
    return {id, type, _colour, _scattering};
  }
}


export class VTFogBox extends VTFog {
  constructor(minPt=new THREE.Vector3(2,2,2), maxPt=new THREE.Vector3(5,5,5), options={...fogDefaultOptions}) {
    super(VTObject.FOG_BOX_TYPE, options);
    this._boundingBox = new THREE.Box3(minPt, maxPt);
    this.makeDirty();
  }

  setBoundingBox(b) { this._boundingBox = b; this.makeDirty(); }

  position(target) { 
    return this._boundingBox.getCenter(target); 
  }
  setPosition(pos) {
    const size = new THREE.Vector3();
    this._boundingBox.getSize(size);
    this._boundingBox.setFromCenterAndSize(pos, size);
    this.makeDirty();
  }

  toJSON() {
    const parentJson = super.toJSON();
    const {_boundingBox} = this;
    return {...parentJson, _boundingBox};
  }

  intersectsBox(box) {
    return this._boundingBox.intersectsBox(box);
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelAABBList(this._boundingBox.min, this._boundingBox.max, true, voxelGridBoundingBox);
  }
}

export class VTFogSphere extends VTFog {
  constructor(center=new THREE.Vector3(4,4,4), radius=4, options={...fogDefaultOptions}) {
    super(VTObject.FOG_SPHERE_TYPE, options);
    this._boundingSphere = new THREE.Sphere(center, radius);
    this.makeDirty();
  }

  setBoundingSphere(s) { this._boundingSphere = s; this.makeDirty(); }
  setRadius(r) { 
    this._boundingSphere.set(this._boundingSphere.center, r);
    this.makeDirty();
  }

  position(target) { 
    return target.copy(this._boundingSphere.center); 
  }
  setPosition(pos) {
    this._boundingSphere.set(pos, this._boundingSphere.radius);
    this.makeDirty();
  }

  toJSON() {
    const parentJson = super.toJSON();
    const {_boundingSphere} = this;
    return {...parentJson, _boundingSphere};
  }

  intersectsBox(box) {
    return this._boundingSphere.intersectsBox(box);
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelSphereList(this._boundingSphere.center, this._boundingSphere.radius, true, voxelGridBoundingBox);
  }
}
