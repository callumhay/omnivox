
import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';
import VoxelGeometryUtils from '../VoxelGeometryUtils';
import InitUtils from '../InitUtils';
import {clamp} from '../MathUtils';

import VTObject from './VTObject';
import VTConstants from './VTConstants';

const defaultAttenuation = {
  quadratic:0.04, 
  linear:0.1, 
};

const _tempVec3 = new THREE.Vector3();

class VTSpotLight extends VTObject {
  // NOTE: Provided angles must be in radians.
  constructor(position, dir, colour, innerConeAngle, outerConeAngle, rangeAtten={...defaultAttenuation}) {
    super(VTConstants.SPOT_LIGHT_TYPE);

    this._position  = InitUtils.initTHREEVector3(position);
    this._direction = InitUtils.initTHREEVector3(dir, 0, -1, 0).normalize();
    this._colour    = InitUtils.initTHREEColor(colour);

    this._innerAngle = InitUtils.initValue(innerConeAngle, Math.PI/6);
    this._outerAngle = InitUtils.initValue(outerConeAngle, Math.PI/4);
    this._rangeAtten = rangeAtten ? {...rangeAtten, ...defaultAttenuation} : {...defaultAttenuation};
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {id, _position, _direction, _colour, _innerAngle, _outerAngle, _rangeAtten} = json;
    this.id = id;
    this._position.copy(_position);//(_position.x, _position.y, _position.z);
    this._direction.copy(_direction);//(_direction.x, _direction.y, _direction.z);
    this._colour.setHex(_colour);
    this._innerAngle = _innerAngle;
    this._outerAngle = _outerAngle;
    this._rangeAtten = _rangeAtten;
    return this;
  }
  toJSON() {
    const {id, type, _position, _direction, _colour, _innerAngle, _outerAngle, _rangeAtten} = this;
    return {id, type, _position, _direction, _colour, _innerAngle, _outerAngle, _rangeAtten};
  }

  setPosition(p) { this._position.copy(p); this.makeDirty(); return this; }
  get position() { return this._position; }

  setDirection(d) { this._direction.copy(d).normalize(); this.makeDirty(); return this; }
  get direction() { return this._direction; }

  setConeAngles(innerAngle, outerAngle) {
    this._innerAngle = innerAngle;
    this._outerAngle = outerAngle;
    this.makeDirty();
    return this;
  }
  get innerAngle() { return this._innerAngle; }
  get outerAngle() { return this._outerAngle; }

  setColour(c) { this._colour.copy(c); this.makeDirty(); return this; }
  get colour()  { return this._colour; }

  setRangeAttenuation(ra) { this._rangeAtten = {...this._rangeAtten, ...ra}; this.makeDirty(); return this; }
  get rangeAttenuation() { return this._rangeAtten; }

  isShadowCaster() { return false; }
  
  emission(targetColour, voxelPos, distance) {
    targetColour.copy(this._colour);
    return targetColour.multiplyScalar(this.calculateAttenuation(voxelPos, distance));
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

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    targetRGBA.a = 1;
    const voxelCenterPt = VoxelGeometryUtils.voxelCenterPt(_tempVec3, voxelIdxPt);
    return this.emission(targetRGBA, voxelCenterPt, this._position.distanceTo(voxelCenterPt));
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

  getCollidingVoxels(voxelGridBoundingBox) {
    // Just return the nearest voxel to this light
    return [VoxelGeometryUtils.closestVoxelIdxPt(this._position)];
  }

};

export default VTSpotLight;