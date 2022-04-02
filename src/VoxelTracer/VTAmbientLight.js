
import * as THREE from 'three';
import VTObject from './VTObject';

class VTAmbientLight extends VTObject {
  constructor(colour=new THREE.Color(0,0,0)) {
    super(VTObject.AMBIENT_LIGHT_TYPE);
    this._colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this.makeDirty();
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

  makeDirty() { this._isDirty = true; }
  isDirty() { return this._isDirty; }
  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  dispose() {}
  emission() { return this._colour.clone(); }
  getCollidingVoxels(voxelGridBoundingBox=null) { return []; } // Nothing to draw
};

export default VTAmbientLight;