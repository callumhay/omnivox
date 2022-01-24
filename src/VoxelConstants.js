import * as THREE from 'three';

const POS_X_VEC3 = new THREE.Vector3(1,0,0);
const NEG_X_VEC3 = new THREE.Vector3(-1,0,0);
const POS_Y_VEC3 = new THREE.Vector3(0,1,0);
const NEG_Y_VEC3 = new THREE.Vector3(0,-1,0);
const POS_Z_VEC3 = new THREE.Vector3(0,0,1);
const NEG_Z_VEC3 = new THREE.Vector3(0,0,-1);

class VoxelConstants {
  static get PROJECT_NAME() { return "Omnivox"; }

  static get VOXEL_GRID_SIZE() { return 16; }
  static get VOXEL_HALF_GRID_SIZE() { return VoxelConstants.VOXEL_GRID_SIZE/2; }
  static get VOXEL_DIAGONAL_GRID_SIZE() { return Math.sqrt(2*VoxelConstants.VOXEL_GRID_SIZE*VoxelConstants.VOXEL_GRID_SIZE); }

  static get VOXEL_GRID_MAX_IDX() { return VoxelConstants.VOXEL_GRID_SIZE-1; }
  static get VOXEL_HALF_GRID_IDX() { return VoxelConstants.VOXEL_GRID_MAX_IDX/2; }

  static get VOXEL_UNIT_SIZE() { return 1;  }
  static get VOXEL_HALF_UNIT_SIZE() { return VoxelConstants.VOXEL_UNIT_SIZE/2; }

  static get VOXEL_EPSILON()   { return 0.00001 };
  static get VOXEL_ERR_UNITS() { return VoxelConstants.VOXEL_UNIT_SIZE / (2.0 + VoxelConstants.VOXEL_EPSILON); }

  static get ORTHO_DIR_STRS() { return ['+x', '-x', '+y', '-y', '+z', '-z']; }
  static get ORTHO_DIR_VEC3S() { return [POS_X_VEC3, NEG_X_VEC3, POS_Y_VEC3, NEG_Y_VEC3, POS_Z_VEC3, NEG_Z_VEC3]; }

  static get DEFAULT_BRIGHTNESS_MULTIPLIER() { return 0.5; }
}
export default VoxelConstants;