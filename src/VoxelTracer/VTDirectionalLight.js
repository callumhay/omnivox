import * as THREE from 'three';

import InitUtils from '../InitUtils';

import VTConstants from './VTConstants';
import VTObject from './VTObject';

class VTDirectionalLight extends VTObject {

  constructor(dir, colour) {
    super(VTConstants.DIRECTIONAL_LIGHT_TYPE);
    this._dir = InitUtils.initTHREEVector3(dir, 0, -1, 0).normalize();
    this._colour = InitUtils.initTHREEColor(colour);
    this.makeDirty();
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {id, _dir, _colour} = json;
    this.id = id;
    this._colour.setHex(_colour);
    this._dir.copy(_dir);
    return this;
  }

  static build(jsonData) {
    const {id, _dir, _colour} = jsonData;
    const colour = (new THREE.Color()).setHex(_colour);
    const dir = new THREE.Vector3(_dir.x, _dir.y, _dir.z);
    const result = new VTDirectionalLight(dir, colour);
    result.id = id;
    return result;
  }
  toJSON() {
    const {id, type, _dir, _colour} = this;
    return {id, type, _dir, _colour};
  }

  setDirection(d) { this._dir = d; this._dir.normalize(); this.makeDirty(); }
  get direction() { return this._dir; }

  setColour(c) { this._colour = c; this.makeDirty(); }
  get colour()  { return this._colour; }

  isShadowCaster() { return false; }
  isShadowReceiver() { return false; }

  emission(targetColour, pos, distance) {
    // NOTE: Both position and distance are meaningless for a directional light
    return targetColour.copy(this._colour);
  }

  getCollidingVoxels(voxelGridBoundingBox) { return []; } // Nothing to draw

}

export default VTDirectionalLight;