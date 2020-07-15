import * as THREE from 'three';

import VoxelModel from '../Server/VoxelModel';

import VTRenderable from './VTRenderable';
import VTMaterialFactory from './VTMaterialFactory';

class VTVoxel extends VTRenderable  {

  constructor(voxelIdxPt, material, options={}) {
    super(VTRenderable.VOXEL_TYPE);

    this._voxelIdxPt = voxelIdxPt;
    this._material = material;
    this._matrixWorld = (options.matrixWorld !== undefined) ? options.matrixWorld : new THREE.Matrix4();
    this._receivesShadow = (options.receivesShadow !== undefined) ? options.receivesShadow : true;

    // Temp variable for calculations
    this._tempVec3 = new THREE.Vector3();

    this.computeBoundingBox();

    this.makeDirty();
  }

  static build(jsonData) {
    const {id, _voxelIdxPt, _material, matrixArray, _receivesShadow} = jsonData;
    const result = new VTVoxel(
      new THREE.Vector3(_voxelIdxPt.x, _voxelIdxPt.y, _voxelIdxPt.z), 
      VTMaterialFactory.build(_material), 
      {receivesShadow: _receivesShadow, matrixWorld: (new THREE.Matrix4()).fromArray(matrixArray)}
    );
    result.id = id;
    return result;
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }
  setMatrixWorld(m) { this._matrixWorld = m; this.computeBoundingBox(); this.makeDirty(); }
  setReceivesShadow(r) { this._receivesShadow = r; this.makeDirty(); }

  dispose() {
    this._material.dispose();
  }

  isDirty() { return this._isDirty; }
  
  makeDirty() { this._isDirty = true; }

  unDirty(scene=null) {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  isShadowCaster() { return true; }

  toJSON() {
    const {id, type, _voxelIdxPt, _material, _matrixWorld, _receivesShadow} = this;
    const matrixArray = _matrixWorld.toArray();
    return {id, type, _voxelIdxPt, _material, matrixArray, _receivesShadow};
  }

  _getWorldSpacePosition(target) {
    target.copy(this._voxelIdxPt);
    target.applyMatrix4(this._matrixWorld);
    return target;
  }

  computeBoundingBox() {
    this._getWorldSpacePosition(this._tempVec3);
    this._boundingBox = VoxelModel.calcVoxelBoundingBox(VoxelModel.closestVoxelIdxPt(this._tempVec3));
  }

  calculateShadow(raycaster) {
    return {
      inShadow: this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(voxelIdxPt=null, scene) {
    // Fast-out if we can't even see this voxel
    if (!this._material.isVisible()) {
      return new THREE.Color(0,0,0);
    }

    this._getWorldSpacePosition(this._tempVec3);
    return scene.calculateVoxelLighting(this._tempVec3, this._material, this._receivesShadow);
  }

  intersectsBox(box) {
    return this._boundingBox.intersectsBox(box);
  }

  intersectsRay(raycaster) {
    return raycaster.ray.intersectsBox(this._boundingBox, this._tempVec3) !== null;
  }

  getCollidingVoxels(voxelBoundingBox=null) {
    return [VoxelModel.closestVoxelIdxPt(this._voxelIdxPt)];
  }
}

export default VTVoxel;