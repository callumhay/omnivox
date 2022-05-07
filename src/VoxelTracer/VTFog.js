
import * as THREE from 'three';
import InitUtils from '../InitUtils';

import VoxelGeometryUtils from '../VoxelGeometryUtils';
import VTConstants from './VTConstants';
import VTObject from './VTObject';

class VTFog extends VTObject {
  constructor(type, colour, scattering) {
    super(type);
    this._colour = InitUtils.initTHREEColor(colour, 1,1,1);
    this._scattering = InitUtils.initValue(scattering, 0.1);
  }

  setColour(c) { this._colour.copy(c); this.makeDirty(); return this; }
  setScattering(s) { this._scattering = s; this.makeDirty(); return this; }

  toJSON() {
    const {id, drawOrder, type, _colour, _scattering} = this;
    return {id, drawOrder, type, _colour, _scattering};
  }
}

export class VTFogBox extends VTFog {
  constructor(minPt, maxPt, colour, scattering) {
    super(VTConstants.FOG_BOX_TYPE, colour, scattering);
    this._boundingBox = new THREE.Box3();
    this._boundingBox.set(minPt, maxPt);
  }

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

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelAABBList(this._boundingBox.min, this._boundingBox.max, true, voxelGridBoundingBox);
  }
}

export class VTFogSphere extends VTFog {
  constructor(center, radius, colour, scattering) {
    super(VTConstants.FOG_SPHERE_TYPE, colour, scattering);
    this._boundingSphere = new THREE.Sphere(InitUtils.initTHREEVector3(center), InitUtils.initValue(radius, 8));
  }

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

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelSphereList(this._boundingSphere.center, this._boundingSphere.radius, true, voxelGridBoundingBox);
  }
}
