
import * as THREE from 'three';

import VTObject from './VTObject';

import VoxelConstants from '../VoxelConstants';
import VoxelGeometryUtils from '../VoxelGeometryUtils';
import {clamp} from '../MathUtils';

class VTSpotLight extends VTObject {
  // NOTE: Provided angles must be in radians.
  constructor(position, direction, colour, innerConeAngle, outerConeAngle, rangeAtten) {
    super(VTObject.SPOT_LIGHT_TYPE);

    this._position = position;
    this._direction = direction;
    this._direction.normalize();
    this._colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this._innerAngle = innerConeAngle;
    this._outerAngle = Math.max(innerConeAngle, outerConeAngle);
    this._rangeAtten = rangeAtten;

    this._isDirty = true;
  }

  static build(jsonData) {
    const {id, _position, _direction, _colour, _innerAngle, _outerAngle, _rangeAtten} = jsonData;
    const result = new VTSpotLight(
      new THREE.Vector3(_position.x, _position.y, _position.z),
      new THREE.Vector3(_direction.x, _direction.y, _direction.z),
      (new THREE.Color()).setHex(_colour), _innerAngle, _outerAngle, _rangeAtten
    );
    result.id = id;
    return result;
  }
  toJSON() {
    const {id, type, _position, _direction, _colour, _innerAngle, _outerAngle, _rangeAtten} = this;
    return {id, type,_position, _direction, _colour, _innerAngle, _outerAngle, _rangeAtten};
  }

  setPosition(p) { this._position = p; this.makeDirty(); }
  get position() { return this._position; }

  setDirection(d) { this._direction = d; this._direction.normalize(); this.makeDirty(); }
  get direction() { return this._direction; }

  setConeAngles(innerAngle, outerAngle) { this._innerAngle = innerAngle; this._outerAngle = outerAngle; this.makeDirty(); }
  get innerAngle() { return this._innerAngle; }
  get outerAngle() { return this._outerAngle; }

  setColour(c) { this._colour = c; this.makeDirty(); }
  get colour()  { return this._colour; }

  setRangeAttenuation(ra) { this._rangeAtten = ra; this.makeDirty(); }
  get rangeAttenuation() { return this._rangeAtten; }

  //setSpotAttenuation(sa) { this._spotAtten = sa; this.makeDirty(); }
  //get spotAttenuation() { return this._spotAtten; }

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
  
  emission(voxelPos, distance) {
    const emissionColour = this._colour.clone().multiplyScalar(this.calculateAttenuation(voxelPos, distance));
    emissionColour.setRGB(emissionColour.r, emissionColour.g, emissionColour.b);
    return emissionColour;
  }

  calculateAttenuation(voxelPos, distance) {
    const rangeAttMultiplier = clamp(1.0 / (1.0 + this._rangeAtten.quadratic*distance*distance + this._rangeAtten.linear*distance), 0, 1);
    // What's the direction from where this light is located to the position we're attenuating?
    const nLightToVoxel = voxelPos.clone();
    nLightToVoxel.sub(this.position).divideScalar(distance);

    // Find the dot product between the light to voxel and spot light direction,
    // then perform the spot light attenuation calculation
    // (https://catlikecoding.com/unity/tutorials/custom-srp/point-and-spot-lights/)
    const dot = nLightToVoxel.dot(this.direction);
    const cosOuter = Math.cos(0.5*this._outerAngle);
    const cosInner = Math.cos(0.5*this._innerAngle);
    const angleRangeInv = 1.0 / Math.max(cosInner-cosOuter, VoxelConstants.VOXEL_EPSILON);
    const spotAttenMultiplier = Math.pow(clamp((dot - cosOuter)*angleRangeInv, 0, 1), 2);

    return rangeAttMultiplier*spotAttenMultiplier;
  }

  calculateVoxelColour(voxelPt, scene=null) {
    const d = this._position.distanceTo(voxelPt);
    return this.emission(voxelPt, d);
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
    // Just return the nearest voxel to this light
    return [VoxelGeometryUtils.closestVoxelIdxPt(this._position)];
  }

};

export default VTSpotLight;