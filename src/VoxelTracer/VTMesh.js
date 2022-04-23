import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTTransformable from './VTTransformable';

// TODO: Stop using a THREE.Mesh and just use the geometry along with the VTTransformable matrixWorld
// to save on JSON size overhead in communication to child render processes

class VTMesh extends VTTransformable {
  // NOTE: All geometry MUST be buffer geometry!
  constructor(geometry, material) {
    super(VTConstants.MESH_TYPE);
    
    this.geometry = geometry;
    this.geometry.computeBoundingBox();
    this.material = material;

    this.makeDirty();
  }

  toJSON() {
    const {id, drawOrder, type, geometry, matrixWorld, material} = this;
    return {id, drawOrder, type, geometry, matrixWorld:matrixWorld.toArray(), material};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    const worldSpaceBB = this.geometry.boundingBox.clone().applyMatrix4(this.matrixWorld);
    const {min, max} = worldSpaceBB;
    return VoxelGeometryUtils.voxelAABBList(min, max, true, voxelGridBoundingBox);
  }
}

export default VTMesh;
