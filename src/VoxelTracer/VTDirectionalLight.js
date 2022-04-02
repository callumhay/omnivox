import * as THREE from 'three';
import VTObject from './VTObject';

class VTDirectionalLight extends VTObject {

  constructor(dir=new THREE.Vector3(1,1,1), colour=new THREE.Color(0,0,0)) {
    super(VTObject.DIRECTIONAL_LIGHT_TYPE);
    this._dir = dir instanceof THREE.Vector3 ? dir : new THREE.Vector3(dir.x, dir.y, dir.z);
    this._dir.normalize();
    this._colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this._isDirty = true;
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
  
  dispose() {}

  isDirty() { return this._isDirty; }
  makeDirty() { this._isDirty = true; }
  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  isShadowCaster() { return false; }

  emission(pos=null, distance=null) {
    // NOTE: Both position and distance are meaningless for a directional light
    return this._colour.clone();
  }

  getCollidingVoxels(voxelGridBoundingBox=null) { return []; } // Nothing to draw

}

export default VTDirectionalLight;