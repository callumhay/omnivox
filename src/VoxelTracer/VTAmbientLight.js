
import * as THREE from 'three';
import VTRenderable from './VTRenderable';

class VTAmbientLight extends VTRenderable {
  constructor(colour=new THREE.Color(0,0,0)) {
    super(VTRenderable.AMBIENT_LIGHT_TYPE);
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

  get colour() { return this._colour; }
  setColour(c) {this._colour = c; this.makeDirty(); }

  makeDirty() { this._isDirty = true; }

  isDirty() { return this._isDirty; }

  unDirty(scene=null) {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  toJSON() {
    const {id, type, _colour} = this;
    return {id, type, _colour};
  }

  dispose() {}

  emission() {
    return this._colour.clone();
  }

  getCollidingVoxels(voxelGridBoundingBox=null) {
    return [];
  }
};

export default VTAmbientLight;