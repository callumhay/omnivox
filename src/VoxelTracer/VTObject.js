import VTConstants from './VTConstants';

class VTObject {
  constructor(type) {
    if (this.constructor === VTObject) { throw new Error("VTObject is an abstract class."); }
    this.id = VTConstants.INVALID_RENDERABLE_ID;
    this.type = type;
    this.drawOrder = VTConstants.DRAW_ORDER_DEFAULT;
  }

  clone() { console.error("clone unimplemented abstract method called."); return null; }

  isDirty() { return this._isDirty; }
  makeDirty() { this._isDirty = true; }
  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  toJSON() { console.error("toJSON unimplemented abstract method called."); return null; }

  // NOTE: The result of this method MUST be inside the voxelGridBoundingBox!
  getCollidingVoxels(voxelGridBoundingBox=null) { console.error("getCollidingVoxels unimplemented abstract method called."); return []; }
}

export default VTObject;
