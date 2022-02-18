import VTConstants from './VTConstants';

class VTObject {
  
  static get MESH_TYPE() { return 'm'; }
  static get AMBIENT_LIGHT_TYPE() { return 'a'; }
  static get POINT_LIGHT_TYPE() { return 'p'; }
  static get SPOT_LIGHT_TYPE() { return 's'; }
  static get VOXEL_TYPE() { return 'v'; }
  static get FOG_BOX_TYPE() { return 'fb'; }
  static get FOG_SPHERE_TYPE() { return 'fs'; }
  static get ISOFIELD_TYPE() { return 'i'; }
  
  constructor(type) {
    if (this.constructor === VTObject) {
      throw new Error("VTObject is an abstract class.");
    }
    this.id = VTConstants.INVALID_RENDERABLE_ID;
    this.type = type;
  }

  isDirty()  { console.error("isDirty unimplemented abstract method called."); return false; }
  unDirty() { console.error("unDirty unimplemented abstract method called."); return true; }

  dispose() { console.error("dispose unimplemented abstract method called."); }
  isShadowCaster() { console.error("isShadowCaster unimplemented abstract method called."); return false; }
  getCollidingVoxels(voxelGridBoundingBox=null) { console.error("getCollidingVoxels unimplemented abstract method called."); return []; }

  calculateShadow(raycaster=null) { console.error("calculateShadow unimplemented abstract method called."); return null; }
  calculateVoxelColour(voxelIdxPt, scene) { console.error("calculateVoxelColour unimplemented abstract method called."); return null; }
}

export default VTObject;