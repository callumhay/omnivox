import * as THREE from 'three';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast, MeshBVH, SAH} from 'three-mesh-bvh';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTObject from './VTObject';


// Add the extension functions for calculating bounding volumes for THREE.Mesh/THREE.Geometry
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

class VTMesh extends VTObject {
  // NOTE: All geometry MUST be buffer geometry!
  constructor(geometry, material) {
    super(VTObject.MESH_TYPE);
    
    this.geometry = geometry;
    this.geometry.computeBoundingBox();
    this.geometry.boundsTree = new MeshBVH(this.geometry, {strategy: SAH});
    this.threeMesh = new THREE.Mesh(this.geometry);
    this.material = material;

    this.makeDirty();
  }

  toJSON() {
    const {id, type, threeMesh, material} = this;
    return {id, type, threeMesh, material};
  }

  dispose() {
    this.geometry.disposeBoundsTree();
    this.geometry.dispose();
    this.material.dispose();
    this.makeDirty();
  }

  isDirty() {
    return this._isDirty;
  }
  makeDirty() {
    this._isDirty = true;
  }
  unDirty() {
    if (this._isDirty) {
      this.updateMatrixWorld();
      this._isDirty = false;
      return true;
    }
    return false;
  }

  isShadowCaster() { return true; }

  // Transform methods
  setPosition(x,y,z) { 
    this.threeMesh.position.set(x,y,z);
    this.makeDirty();
  }
  updateMatrixWorld() { this.threeMesh.updateMatrixWorld(); }

  intersectsBox(box) {
    return this.geometry.boundsTree.intersectsBox(this.threeMesh, box, new THREE.Matrix4());
  }
  intersectsRay(raycaster) {
    raycaster.firstHitOnly = true;
    return raycaster.intersectObjects([this.threeMesh]).length > 0;
  }
  getCollidingVoxels(voxelGridBoundingBox) {
    const worldSpaceBB = this.geometry.boundingBox.clone().applyMatrix4(this.threeMesh.matrixWorld);
    return VoxelGeometryUtils.voxelAABBList(worldSpaceBB.min, worldSpaceBB.max, true, voxelGridBoundingBox);
  }
}

export default VTMesh;
