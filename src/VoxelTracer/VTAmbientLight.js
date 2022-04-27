import * as THREE from 'three';

import InitUtils from '../InitUtils';

import VTConstants from './VTConstants';
import VTObject from './VTObject';

class VTAmbientLight extends VTObject {
  constructor(colour) {
    super(VTConstants.AMBIENT_LIGHT_TYPE);
    this._colour = InitUtils.initTHREEColor(colour);
    this.makeDirty();
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {id, _colour} = json;
    this.id = id;
    this._colour.setHex(_colour);
    return this;
  }

  static build(jsonData) {
    const {id, _colour} = jsonData;
    const colour = (new THREE.Color()).setHex(_colour);
    const result = new VTAmbientLight(colour);
    result.id = id;
    return result;
  }
  toJSON() {
    const {id, type, _colour} = this;
    return {id, type, _colour};
  }

  get colour() { return this._colour; }
  setColour(c) {this._colour = c; this.makeDirty(); }

  emission(targetColour) { return targetColour.copy(this._colour); }
  
  getCollidingVoxels(voxelGridBoundingBox=null) { return []; } // Nothing to draw
};

export default VTAmbientLight;