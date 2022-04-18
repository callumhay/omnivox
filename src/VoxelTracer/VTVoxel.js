import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';
import VTMaterialFactory from './VTMaterialFactory';

import VTObject from './VTObject';

export class VTVoxelAbstract extends VTObject {
  constructor(position, material, options={}) {
    super(VTObject.VOXEL_TYPE);
    if (this.constructor === VTVoxelAbstract) { throw new Error("VTVoxelAbstract is an abstract class."); }

    this._position = position || new THREE.Vector3(0,0,0);
    this._material = (typeof material === 'string' || material instanceof String) ? VTMaterialFactory.build(material) : material;
    this._receivesShadow = (options.receivesShadow !== undefined) ? options.receivesShadow : true;
    this._castsShadow    = (options.castsShadow !== undefined) ? options.castsShadow : true;

    // Temp variable for calculations
    this._tempVec3 = new THREE.Vector3();

    this.computeBoundingBox();
  }

  dispose() { this._material.dispose(); }

  isShadowCaster() { return this._castsShadow; }

  //_getWorldSpacePosition(target) {
  //  target.copy(this._position);
  //  target.applyMatrix4(this._matrixWorld);
  //  return target;
  //}

  computeBoundingBox() {
    //this._getWorldSpacePosition(this._tempVec3);
    this._boundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(this._position);
  }

  intersectsRay(raycaster) { return raycaster.ray.intersectsBox(this._boundingBox, this._tempVec3) !== null; }

  getCollidingVoxels(voxelGridBoundingBox) {
    const closestPt = VoxelGeometryUtils.closestVoxelIdxPt(this._position);
    return voxelGridBoundingBox.containsPoint(closestPt) ? [closestPt] : [];
  }
}

export const defaultVTVoxelOptions = {
  receivesShadow: true,
  castsShadow: true,
};

class VTVoxel extends VTVoxelAbstract  {

  constructor(position=null, material=null, options={...defaultVTVoxelOptions}) {
    super(position, material, options);
    this.makeDirty();
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }

  setReceivesShadow(r) { this._receivesShadow = r; this.makeDirty(); }
  setCastsShadow(c) { this._castsShadow = c; this.makeDirty(); }

  // Transform methods
  setWorldPosition(p) { this._position.copy(p); this.makeDirty(); }
  setLocalRotationEuler(r) {}  // NOTE: Single voxels have no local orientation
  setLocalScale(sX, sY, sZ) {} // NOTE: Single voxels have no scale

  toJSON() {
    const {id, drawOrder, type, _position, _material, _receivesShadow, _castsShadow} = this;
    //const matrixArray = _matrixWorld.toArray();
    return {id, drawOrder, type, _position, _material, _receivesShadow, _castsShadow};
  }

  intersectsBox(box) { return this._boundingBox.intersectsBox(box); }
}

export default VTVoxel;