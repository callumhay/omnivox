import * as THREE from 'three';

import VoxelModel from '../Server/VoxelModel';

class VTVoxel {

  constructor(voxelIndexPt, material, options={}) {

    this.voxelIndexPt = voxelIndexPt;
    this.material = material;
    this.matrixWorld = new THREE.Matrix4();
    this.receivesShadow = (options.receivesShadow !== undefined) ? options.receivesShadow : true;

    this._tempVec3 = new THREE.Vector3();

    this.computeBoundingBox();
  }

  dispose() {
    this.material.dispose();
  }

  worldSpacePosition(target) {
    target.copy(this.voxelIndexPt);
    target.applyMatrix4(this.matrixWorld);
    return target;
  }

  computeBoundingBox() {
    this.worldSpacePosition(this._tempVec3);
    this.boundingBox = VoxelModel.calcVoxelBoundingBox(VoxelModel.closestVoxelIdxPt(this._tempVec3));
  }

  //get position() { return this.position; }
  //updateMatrixWorld() { this._threeMesh.updateMatrixWorld(); }

  calculateShadow(raycaster) {
    return {
      inShadow: this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  preRender(voxelIdxPt) {} // No memoization for single Voxels

  calculateVoxelColour(voxelIdxPt, scene) {
    // Fast-out if we can't even see this mesh
    if (!this.material.isVisible()) {
      return new THREE.Color(0,0,0);
    }

    const worldSpaceVoxelPt = new THREE.Vector3();
    this.worldSpacePosition(worldSpaceVoxelPt);

    return scene.calculateVoxelLighting(worldSpaceVoxelPt, this.material, this.receivesShadow);
  }

  intersectsBox(box) {
    return this.boundingBox.intersectsBox(box);
  }

  intersectsRay(raycaster) {
    return raycaster.ray.intersectsBox(this.boundingBox, this._tempVec3) !== null;
  }

  getCollidingVoxels(voxelBoundingBox=null) {
    return [VoxelModel.closestVoxelIdxPt(this.voxelIndexPt)];
  }
}

export default VTVoxel;