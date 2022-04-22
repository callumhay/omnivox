import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTTransformable from './VTTransformable';

class VTMesh extends VTTransformable {
  // NOTE: All geometry MUST be buffer geometry!
  constructor(geometry, material) {
    super(VTConstants.MESH_TYPE);
    
    this.geometry = geometry;
    this.geometry.computeBoundingBox();
    this.material = material;
    this._mesh  = new THREE.Mesh(geometry);

    this.makeDirty();
  }

  unDirty() {
    if (super.unDirty()) {
      // Update the mesh for transfer to the render processes
      this._mesh.position.copy(this.position);
      this._mesh.position.copy(this.position);
      this._mesh.rotation.order = this.rotation.order;
      this._mesh.quaternion.copy(this.quaternion);
      this._mesh.scale.copy(this.scale);
      this._mesh.matrix.copy(this.matrix);
      this._mesh.matrixWorld.copy(this.matrixWorld);
      return true;
    }
    return false;
  }

  toJSON() {
    const {id, drawOrder, type, _mesh, material} = this;
    return {id, drawOrder, type, threeMesh:_mesh , material};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    const worldSpaceBB = this.geometry.boundingBox.clone().applyMatrix4(this.matrixWorld);
    const {min, max} = worldSpaceBB;
    return VoxelGeometryUtils.voxelAABBList(min, max, true, voxelGridBoundingBox);
  }
}

export default VTMesh;
