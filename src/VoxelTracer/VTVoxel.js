import * as THREE from 'three';

import InitUtils from '../InitUtils';
import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTMaterialFactory from './VTMaterialFactory';
import VTObject from './VTObject';

export const defaultVTVoxelOptions = {
  receivesShadows: true,
  castsShadows: true,
};

// TODO: REFACTOR TO USE VTTransformable
class VTVoxel extends VTObject  {

  constructor(position, material, options) {
    super(VTConstants.VOXEL_TYPE);

    this._position = InitUtils.initTHREEVector3(position);
    this._material = VTMaterialFactory.initMaterial(material);
    this._options = options ? {...defaultVTVoxelOptions, ...options} : {...defaultVTVoxelOptions};

    this.makeDirty();
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }

  setReceivesShadows(r) { this._options.receivesShadows = r; this.makeDirty(); }
  setCastsShadows(c) { this._options.castsShadows = c; this.makeDirty(); }

  // Transform methods
  setWorldPosition(p) { this._position.copy(p); this.makeDirty(); }
  setLocalRotationEuler(r) {}  // NOTE: Single voxels have no local orientation
  setLocalScale(sX, sY, sZ) {} // NOTE: Single voxels have no scale

  toJSON() {
    const {id, drawOrder, type, _position, _material, _options} = this;
    return {id, drawOrder, type, _position, _material, _options};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    const closestPt = VoxelGeometryUtils.closestVoxelIdxPt(this._position);
    closestPt.floor();
    return voxelGridBoundingBox.containsPoint(closestPt) ? [closestPt] : [];
  }
}

export default VTVoxel;