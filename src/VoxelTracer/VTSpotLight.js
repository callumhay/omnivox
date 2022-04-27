
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

    this._innerAngle = innerConeAngle || Math.PI/6;
    this._outerAngle = Math.max(innerConeAngle, (outerConeAngle || Math.PI/4));
    this._rangeAtten = rangeAtten;

    this.makeDirty();
  }

  fromJSON(json, pool) {
    const {id, _position, _direction, _colour, _innerAngle, _outerAngle, _rangeAtten} = json;
    this.id = id;
    this._position.copy(_position);
    this._direction.copy(_direction);
    this._colour.setHex(_colour);
    this._innerAngle = _innerAngle;
    this._outerAngle = _outerAngle;
    this._rangeAtten = _rangeAtten;
    return this;
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