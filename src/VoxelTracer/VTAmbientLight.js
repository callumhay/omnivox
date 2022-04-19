
import * as THREE from 'three';
import VTConstants from './VTConstants';
import VTObject from './VTObject';

class VTAmbientLight extends VTObject {
  constructor(colour=new THREE.Color(0,0,0)) {
    super(VTConstants.AMBIENT_LIGHT_TYPE);
    this._colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this.makeDirty();
  }

  dispose() {}

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

  emission() { return this._colour.clone(); }
  
  getCollidingVoxels(voxelGridBoundingBox=null) { return []; } // Nothing to draw
};

export default VTAmbientLight;