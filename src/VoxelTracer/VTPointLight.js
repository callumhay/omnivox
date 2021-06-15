import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTObject from './VTObject';

export const defaultAttenuation = {
  quadratic:0, 
  linear:1, 
};

class VTPointLight extends VTObject {
  constructor(position, colour, attenuation=defaultAttenuation) {
    super(VTObject.POINT_LIGHT_TYPE);

    this._position = position;
    this._colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this._attenuation = attenuation;
    this._isDirty = true;
  }

  static build(jsonData) {
    const {id, _position, _colour, _attenuation} = jsonData;
    const colour = (new THREE.Color()).setHex(_colour);
    const result = new VTPointLight(new THREE.Vector3(_position.x, _position.y, _position.z), colour, _attenuation);
    result.id = id;
    return result;
  }

  setPosition(p) { this._position = p; this.makeDirty(); }
  get position() { return this._position; }

  setColour(c) { this._colour = c; this.makeDirty(); }
  get colour()  { return this._colour; }

  setAttenuation(a) { this._attenuation = a; this.makeDirty(); }
  get attenuation() { return this._attenuation; }

  dispose() {}

  isDirty() { return this._isDirty; }
  makeDirty() { this._isDirty = true; }
  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  isShadowCaster() { return false; }

  toJSON() {
    const {id, type, _position, _colour, _attenuation} = this;
    return {id, type, _position, _colour, _attenuation};
  }

  emission(distance) {
    // TODO: This can blow out a colour... maybe map it to a spectrum or something when we want to get fancy?
    const emissionColour = this._colour.clone().multiplyScalar(this.calculateAttenuation(distance));
    emissionColour.setRGB(emissionColour.r, emissionColour.g, emissionColour.b);
    return emissionColour;
  }

  calculateAttenuation(distance) {
    return 1.0 / (this._attenuation.quadratic*distance*distance + this._attenuation.linear*distance + 1.0); // Always in [0,1]
  }

  calculateVoxelColour(voxelPt, scene=null) {
    const d = this._position.distanceTo(voxelPt);
    return this.emission(d);
  }

  intersectsBox(voxelBoundingBox) {
    return this.boundingSphere().intersectsBox(voxelBoundingBox);
  }

  boundingBox() {
    const minPos = this._position.clone().subScalar(0.5);
    const maxPos = this._position.clone().addScalar(0.5);
    return new THREE.Box3(minPos, maxPos);
  }

  boundingSphere() {
    return new THREE.Sphere(this._position.clone(), 0.5);
  }

  getCollidingVoxels(voxelGridBoundingBox=null) {
    // Just return the nearest voxel to this light (since it's a point light it will only be a single voxel)
    return [VoxelGeometryUtils.closestVoxelIdxPt(this._position)];
  }
}

export default VTPointLight;