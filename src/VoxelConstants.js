import * as THREE from 'three';
import { SQRT3 } from './MathUtils';

const POS_X_VEC3 = new THREE.Vector3(1,0,0);
const NEG_X_VEC3 = new THREE.Vector3(-1,0,0);
const POS_Y_VEC3 = new THREE.Vector3(0,1,0);
const NEG_Y_VEC3 = new THREE.Vector3(0,-1,0);
const POS_Z_VEC3 = new THREE.Vector3(0,0,1);
const NEG_Z_VEC3 = new THREE.Vector3(0,0,-1);

const GRID_SIZE = 16;
const DIAGONAL_GRID_SIZE = Math.sqrt(2*GRID_SIZE*GRID_SIZE);
const UNIT_SIZE = 1;
const DIAGONAL_UNIT_SIZE = Math.sqrt(2*UNIT_SIZE);

class VoxelConstants {
  static get PROJECT_NAME() { return "Omnivox"; }

  static get VOXEL_GRID_SIZE() { return GRID_SIZE; }
  static get VOXEL_HALF_GRID_SIZE() { return VoxelConstants.VOXEL_GRID_SIZE/2; }
  static get VOXEL_DIAGONAL_GRID_SIZE() { return DIAGONAL_GRID_SIZE; }

  static get VOXEL_GRID_MAX_IDX() { return VoxelConstants.VOXEL_GRID_SIZE-1; }
  static get VOXEL_HALF_GRID_IDX() { return VoxelConstants.VOXEL_GRID_MAX_IDX/2; }
  static get VOXEL_HALF_GRID_UNIT() { return VoxelConstants.VOXEL_GRID_MAX_IDX/2; }

  static get VOXEL_UNIT_SIZE() { return UNIT_SIZE;  }
  static get VOXEL_HALF_UNIT_SIZE() { return UNIT_SIZE/2; }
  static get VOXEL_DIAGONAL_UNIT_SIZE() { return DIAGONAL_UNIT_SIZE; }

  static get VOXEL_EPSILON()   { return 0.00001 };
  static get VOXEL_ERR_UNITS() { return VoxelConstants.VOXEL_UNIT_SIZE / (2.0 + VoxelConstants.VOXEL_EPSILON); }
  static get VOXEL_DIAGONAL_ERR_UNITS() { return SQRT3*this.VOXEL_ERR_UNITS; }

  static get ORTHO_DIR_STRS() { return ['+x', '-x', '+y', '-y', '+z', '-z']; }
  static get ORTHO_DIR_VEC3S() { return [POS_X_VEC3, NEG_X_VEC3, POS_Y_VEC3, NEG_Y_VEC3, POS_Z_VEC3, NEG_Z_VEC3]; }

  static get DEFAULT_BRIGHTNESS_MULTIPLIER() { return 1.0; }//0.5; }

  static get NUM_AUDIO_SAMPLES_PER_SEC() { return 20; }
}
export default VoxelConstants;