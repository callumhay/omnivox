import * as THREE from 'three';

import VoxelModel from '../Server/VoxelModel';

import VTObject from './VTObject';

export class VTVoxelAbstract extends VTObject {
  constructor(voxelIdxPt, material, options={}) {
    super(VTObject.VOXEL_TYPE);
    if (this.constructor === VTVoxelAbstract) {
      throw new Error("VTVoxelAbstract is an abstract class.");
    }

    this._voxelIdxPt = voxelIdxPt;
    this._material = material;
    this._matrixWorld = (options.matrixWorld !== undefined) ? options.matrixWorld : new THREE.Matrix4();
    this._receivesShadow = (options.receivesShadow !== undefined) ? options.receivesShadow : true;

    // Temp variable for calculations
    this._tempVec3 = new THREE.Vector3();

    this.computeBoundingBox();
  }

  dispose() {
    this._material.dispose();
  }

  isShadowCaster() { return true; }

  _getWorldSpacePosition(target) {
    target.copy(this._voxelIdxPt);
    target.applyMatrix4(this._matrixWorld);
    return target;
  }

  computeBoundingBox() {
    this._getWorldSpacePosition(this._tempVec3);
    this._boundingBox = VoxelModel.calcVoxelBoundingBox(VoxelModel.closestVoxelIdxPt(this._tempVec3));
  }

  intersectsRay(raycaster) {
    return raycaster.ray.intersectsBox(this._boundingBox, this._tempVec3) !== null;
  }

  getCollidingVoxels(voxelBoundingBox=null) {
    return [VoxelModel.closestVoxelIdxPt(this._voxelIdxPt)];
  }
}

class VTVoxel extends VTVoxelAbstract  {

  constructor(voxelIdxPt, material, options={}) {
    super(voxelIdxPt, material, options);
    this.makeDirty();
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }
  setMatrixWorld(m) { this._matrixWorld = m; this.computeBoundingBox(); this.makeDirty(); }
  setReceivesShadow(r) { this._receivesShadow = r; this.makeDirty(); }

  isDirty() { return this._isDirty; }
  makeDirty() { this._isDirty = true; }
  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  toJSON() {
    const {id, type, _voxelIdxPt, _material, _matrixWorld, _receivesShadow} = this;
    const matrixArray = _matrixWorld.toArray();
    return {id, type, _voxelIdxPt, _material, matrixArray, _receivesShadow};
  }

  intersectsBox(box) {
    return this._boundingBox.intersectsBox(box);
  }
}

export default VTVoxel;