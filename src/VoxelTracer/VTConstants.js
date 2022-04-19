
class VTConstants {
  // Object Type Definitions
  static get MESH_TYPE() { return 'm'; }
  static get SPHERE_TYPE() { return 'sp'; }
  static get BOX_TYPE() { return 'b'; }
  static get AMBIENT_LIGHT_TYPE() { return 'a'; }
  static get POINT_LIGHT_TYPE() { return 'p'; }
  static get SPOT_LIGHT_TYPE() { return 's'; }
  static get DIRECTIONAL_LIGHT_TYPE() { return 'd'; }
  static get VOXEL_TYPE() { return 'v'; }
  static get FOG_BOX_TYPE() { return 'fb'; }
  static get FOG_SPHERE_TYPE() { return 'fs'; }
  static get ISOFIELD_TYPE() { return 'i'; }

  static get INVALID_RENDERABLE_ID() { return -1; }

  // Draw Order Definitions
  static get DRAW_ORDER_LOWEST() { return 0; }
  static get DRAW_ORDER_DEFAULT() { return VTConstants.DRAW_ORDER_LOWEST + 1; }
}

export default VTConstants;
