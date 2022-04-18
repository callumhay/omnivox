import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';
import {clamp} from '../MathUtils';

import VTObject from './VTObject';

const defaultAttenuation = {
  quadratic:0.04, 
  linear:0.1, 
};

class VTPointLight extends VTObject {
  constructor(position, colour, attenuation=defaultAttenuation, drawLight=true) {
    super(VTObject.POINT_LIGHT_TYPE);

    this._position = position;
    this._colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this._attenuation = attenuation;
    this._isDirty = true;
    this._drawLight = drawLight;
  }

  static build(jsonData) {
    const {id, _position, _colour, _attenuation, _drawLight} = jsonData;
    const colour = (new THREE.Color()).setHex(_colour);
    const result = new VTPointLight(new THREE.Vector3(_position.x, _position.y, _position.z), colour, _attenuation, _drawLight);
    result.id = id;
    return result;
  }
  toJSON() {
    const {id, type, _position, _colour, _attenuation, _drawLight} = this;
    return {id, type, _position, _colour, _attenuation, _drawLight};
  }

  setPosition(p) { this._position = p; this.makeDirty(); }
  get position() { return this._position; }

  setColour(c) { this._colour = c; this.makeDirty(); }
  get colour()  { return this._colour; }

  setAttenuation(a) { this._attenuation = a; this.makeDirty(); }
  get attenuation() { return this._attenuation; }

  setDrawLight(drawLight) { this._drawLight = drawLight; this.makeDirty(); }
  get drawLight() { return this._drawLight; }

  dispose() {}

  isShadowCaster() { return false; }

  emission(pos, distance) {
    const emissionColour = this._colour.clone().multiplyScalar(Math.min(1, this.calculateAttenuation(distance)));
    return emissionColour;
  }

  calculateAttenuation(distance) {
    return clamp(1.0 / (1.0 + this._attenuation.quadratic*distance*distance + this._attenuation.linear*distance), 0, 1);
  }

  calculateVoxelColour(voxelPt, scene=null) {
    if (!this._drawLight) { return new THREE.Color(0,0,0); }
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

  getCollidingVoxels(voxelGridBoundingBox) {
    // No drawable voxels if not enabled or if the position is outside of the voxel grid
    if (!this._drawLight || !voxelGridBoundingBox.containsPoint(this._position)) { return []; }

    // Just return the nearest voxel to this light (since it's a point light it will only be a single voxel)
    return [VoxelGeometryUtils.closestVoxelIdxPt(this._position)];
  }
}

export default VTPointLight;