import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTObject from './VTObject';

class VTMesh extends VTObject {
  // NOTE: All geometry MUST be buffer geometry!
  constructor(geometry, material) {
    super(VTConstants.MESH_TYPE);
    
    this.geometry = geometry;
    this.geometry.computeBoundingBox();
    this.threeMesh = new THREE.Mesh(this.geometry); // TODO: Remove this once transforms are implemented.
    this.material = material;

    this.makeDirty();
  }

  toJSON() {
    const {id, drawOrder, type, threeMesh, material} = this;
    return {id, drawOrder, type, threeMesh, material};
  }

  unDirty() { if (super.unDirty()) { this.updateMatrixWorld(); } }

  // Transform methods
  setPosition(x,y,z) { 
    this.threeMesh.position.set(x,y,z);
    this.makeDirty();
  }
  setPositionFromVec3(v) {
    this.threeMesh.position.copy(v);
    this.makeDirty();
  }
  setRotationFromEuler(euler) {
    this.threeMesh.rotation.copy(euler);
    this.makeDirty();
  }
  setRotationFromQuaternion(q) {
    this.threeMesh.rotation.setFromQuaternion(q);
    this.makeDirty();
  }
  updateMatrixWorld() { this.threeMesh.updateMatrixWorld(); }

  getCollidingVoxels(voxelGridBoundingBox) {
    const worldSpaceBB = this.geometry.boundingBox.clone().applyMatrix4(this.threeMesh.matrixWorld);
    return VoxelGeometryUtils.voxelAABBList(worldSpaceBB.min, worldSpaceBB.max, true, voxelGridBoundingBox);
  }
}

export default VTMesh;
