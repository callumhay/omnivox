import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';
import InitUtils from '../InitUtils';
import {clamp} from '../MathUtils';

import VTObject from './VTObject';
import VTConstants from './VTConstants';

const defaultAttenuation = {
  quadratic: 0.04, 
  linear: 0.1,
};

const _tempVec3 = new THREE.Vector3();

// TODO: Inherit from VTTransformable
class VTPointLight extends VTObject {
  constructor(position, colour, attenuation, drawLight) {
    super(VTConstants.POINT_LIGHT_TYPE);

    this._position    = InitUtils.initTHREEVector3(position);
    this._colour      = InitUtils.initTHREEColor(colour);
    this._attenuation = attenuation ? {...defaultAttenuation, ...attenuation} : {...defaultAttenuation};
    this._drawLight   = InitUtils.initValue(drawLight, true);
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {id, _position, _colour, _attenuation, _drawLight} = json;
    this.id = id;
    this._position.copy(_position);
    this._colour.setHex(_colour);
    this._attenuation = _attenuation;
    this._drawLight = _drawLight;
    return this;
  }
  toJSON() {
    const {id, type, _position, _colour, _attenuation, _drawLight} = this;
    return {id, type, _position, _colour, _attenuation, _drawLight};
  }

  get position() { return this._position; }
  setPosition(p) { this._position.copy(p); this.makeDirty(); return this; }
  
  get colour()  { return this._colour; }
  setColour(c) { this._colour.copy(c); this.makeDirty(); return this; }

  get attenuation() { return this._attenuation; }
  setAttenuation(a) { this._attenuation = {...this._attenuation, ...a}; this.makeDirty(); return this; }

  get drawLight() { return this._drawLight; }
  setDrawLight(drawLight) { this._drawLight = drawLight; this.makeDirty(); return this; }

  isShadowCaster() { return false; }

  emission(targetColour, pos, distance) {
    targetColour.copy(this._colour)
    targetColour.multiplyScalar(Math.min(1, this.calculateAttenuation(distance)));
    return targetColour;
  }

  calculateAttenuation(distance) {
    return clamp(1.0 / (1.0 + this._attenuation.quadratic*distance*distance + this._attenuation.linear*distance), 0, 1);
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene=null) {
    if (!this._drawLight) { return targetRGBA.setRGBA(0,0,0,0); }
    const voxelCenterPt = VoxelGeometryUtils.voxelCenterPt(_tempVec3, voxelIdxPt);
    targetRGBA.a = 1;
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
    // No drawable voxels if not enabled or if the position is outside of the voxel grid
    if (!this._drawLight || !voxelGridBoundingBox.containsPoint(this._position)) { return []; }

    // Just return the nearest voxel to this light (since it's a point light it will only be a single voxel)
    return [VoxelGeometryUtils.closestVoxelIdxPt(this._position)];
  }
}

export default VTPointLight;