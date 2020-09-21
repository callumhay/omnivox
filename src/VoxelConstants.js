
class VoxelConstants {
  static get VOXEL_GRID_SIZE() { return 32; }
  static get VOXEL_HALF_GRID_SIZE() { return VoxelConstants.VOXEL_GRID_SIZE/2; }

  static get VOXEL_GRID_MAX_IDX() { return VoxelConstants.VOXEL_GRID_SIZE-1; }
  static get VOXEL_HALF_GRID_IDX() { return VoxelConstants.VOXEL_GRID_MAX_IDX/2; }

  static get VOXEL_UNIT_SIZE() { return 1;  }
  static get VOXEL_HALF_UNIT_SIZE() { return VoxelConstants.VOXEL_UNIT_SIZE/2; }

  static get VOXEL_EPSILON()   { return 0.00001 };
  static get VOXEL_ERR_UNITS() { return VoxelConstants.VOXEL_UNIT_SIZE / (2.0 + VoxelConstants.VOXEL_EPSILON); }
}
export default VoxelConstants;