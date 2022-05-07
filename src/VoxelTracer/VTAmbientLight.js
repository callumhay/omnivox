import * as THREE from 'three';

import InitUtils from '../InitUtils';

import VTConstants from './VTConstants';
import VTObject from './VTObject';

class VTAmbientLight extends VTObject {
  constructor(colour) {
    super(VTConstants.AMBIENT_LIGHT_TYPE);

    this._colour = InitUtils.initTHREEColor(colour);
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {id, _colour} = json;
    this.id = id;
    this._colour.setHex(_colour);
    return this;
  }
  toJSON() {
    const {id, type, _colour} = this;
    return {id, type, _colour};
  }

  get colour() { return this._colour; }
  setColour(c) {this._colour.copy(c); this.makeDirty(); return this; }

  emission(targetColour) { return targetColour.copy(this._colour); }
  
  getCollidingVoxels(voxelGridBoundingBox=null) { return []; } // Nothing to draw
};

export default VTAmbientLight;