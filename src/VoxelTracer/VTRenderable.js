import VTConstants from './VTConstants';

class VTRenderable {
  
  static get MESH_TYPE() { return 'm'; }
  static get AMBIENT_LIGHT_TYPE() { return 'a'; }
  static get POINT_LIGHT_TYPE() { return 'p'; }
  static get VOXEL_TYPE() { return 'v'; }
  static get FOG_TYPE() { return 'f'; }
  
  constructor(type) {
    this.id = VTConstants.INVALID_RENDERABLE_ID;
    this.type = type;
  }

  dispose() { console.error("dispose unimplemented abstract method called."); }
  isDirty()  { console.error("isDirty unimplemented abstract method called."); return false; }
  unDirty(scene=null) { console.error("unDirty unimplemented abstract method called."); return true; }
  isShadowCaster() { console.error("isShadowCaster unimplemented abstract method called."); return false; }
  getCollidingVoxels(voxelGridBoundingBox=null) { console.error("getCollidingVoxels unimplemented abstract method called."); return []; }
}

export default VTRenderable;