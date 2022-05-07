import * as THREE from 'three';

import InitUtils from '../InitUtils';

import VTConstants from './VTConstants';
import VTObject from './VTObject';

class VTDirectionalLight extends VTObject {

  constructor(dir, colour) {
    super(VTConstants.DIRECTIONAL_LIGHT_TYPE);
    this._dir    = InitUtils.initTHREEVector3(dir, 0, -1, 0).normalize();
    this._colour = InitUtils.initTHREEColor(colour);
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {id, _dir, _colour} = json;
    this.id = id;
    this._colour.setHex(_colour);
    this._dir.copy(_dir);
    return this;
  }
  toJSON() {
    const {id, type, _dir, _colour} = this;
    return {id, type, _dir, _colour};
  }

  setDirection(d) { this._dir.copy(d).normalize(); this.makeDirty(); return this; }
  get direction() { return this._dir; }

  setColour(c) { this._colour.copy(c); this.makeDirty(); return this; }
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