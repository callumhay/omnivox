import * as THREE from 'three';

import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTMaterialFactory from './VTMaterialFactory';
import VTObject from './VTObject';

export const defaultVTVoxelOptions = {
  receivesShadows: true,
  castsShadows: true,
};

class VTVoxel extends VTObject  {

  constructor(position=null, material=null, options={...defaultVTVoxelOptions}) {
    super(VTConstants.VOXEL_TYPE);

    this._position = position || new THREE.Vector3(0,0,0);
    this._material = (typeof material === 'string' || material instanceof String) ? VTMaterialFactory.build(material) : material;

    this._options = options;
    this._options.receivesShadows = (options.receivesShadows !== undefined) ? options.receivesShadows : true;
    this._options.castsShadows    = (options.castsShadows !== undefined) ? options.castsShadows : true;

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