import VTConstants from './VTConstants';

class VTObject {
  
  // Object Type Definitions
  static get MESH_TYPE() { return 'm'; }
  static get SPHERE_TYPE() { return 'sp'; }
  static get AMBIENT_LIGHT_TYPE() { return 'a'; }
  static get POINT_LIGHT_TYPE() { return 'p'; }
  static get SPOT_LIGHT_TYPE() { return 's'; }
  static get DIRECTIONAL_LIGHT_TYPE() { return 'd'; }
  static get VOXEL_TYPE() { return 'v'; }
  static get FOG_BOX_TYPE() { return 'fb'; }
  static get FOG_SPHERE_TYPE() { return 'fs'; }
  static get ISOFIELD_TYPE() { return 'i'; }

  // Draw Order Definitions
  static get DRAW_ORDER_LOWEST() { return 0; }
  static get DRAW_ORDER_DEFAULT() { return this.DRAW_ORDER_LOWEST + 1; }
  
  constructor(type) {
    if (this.constructor === VTObject) { throw new Error("VTObject is an abstract class."); }
    this.id = VTConstants.INVALID_RENDERABLE_ID;
    this.type = type;
    this.drawOrder = VTObject.DRAW_ORDER_DEFAULT;
  }

  clone() { console.error("clone unimplemented abstract method called."); return null; }

  isDirty() { console.error("isDirty unimplemented abstract method called."); return false; }
  unDirty() { console.error("unDirty unimplemented abstract method called."); return true; }

  dispose() { console.error("dispose unimplemented abstract method called."); }
  isShadowCaster() { console.error("isShadowCaster unimplemented abstract method called."); return false; }

  // NOTE: The result of this method MUST be inside the voxelGridBoundingBox!
  getCollidingVoxels(voxelGridBoundingBox=null) { console.error("getCollidingVoxels unimplemented abstract method called."); return []; }

  calculateShadow(raycaster=null) { console.error("calculateShadow unimplemented abstract method called."); return null; }
  calculateVoxelColour(voxelIdxPt, scene) { console.error("calculateVoxelColour unimplemented abstract method called."); return null; }
}

export default VTObject;