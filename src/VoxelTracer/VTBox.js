import * as THREE from 'three';
import VoxelConstants from '../VoxelConstants';
import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTObject from "./VTObject";

export const defaultBoxOptions = {
  samplesPerVoxel: 4,
  fill: false,
  castsShadows: true,
  receivesShadows: true,
};

export class VTBoxAbstract extends VTObject {
  constructor(center, size, material, options) {
    super(VTObject.BOX_TYPE);

    size.multiplyScalar(0.5);
    const min = center.clone().sub(size);
    const max = center.add(size);

    this._box = new THREE.Box3(min, max); // TODO: Make this the non-transformed box, then have the center be a local translation
    this._material = material;
    this._options  = options;

    this._localRotation = new THREE.Euler(0,0,0);
  }

  dispose() { this._material.dispose(); }
  isShadowCaster() { return this._options.castsShadows || false; }

  isFilled() { return this._options.fill || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }

  intersectsRay(raycaster) { return raycaster.ray.intersectsBox(this._box); }

  getCollidingVoxels(voxelBoundingBox) {
    return VoxelGeometryUtils.voxelBoxListMinMax(this._box.min, this._box.max, this._localRotation, true, voxelBoundingBox);
  }
}

const tempCenter = new THREE.Vector3();
const tempSize  = new THREE.Vector3();

export class VTBox extends VTBoxAbstract {
  constructor(center, size, material, options={...defaultBoxOptions}) {
    super(center, size, material, options);
    this.makeDirty();
  }

  get material() { return this._material; }
  setMaterial(m) { this._material = m; this.makeDirty(); }
  get box() { return this._box; }
  setBox(b) { this._box = b; this.makeDirty(); }

  get localRotationEuler() { return this._localRotation; }
  setLocalRotationEuler(r) { this._localRotation = r; this.makeDirty(); }

  toJSON() {
    const {id, drawOrder, type, _box, _material, _options} = this;
    _box.getCenter(tempCenter);
    _box.getSize(tempSize);
    return {id, drawOrder, type, center: tempCenter, size: tempSize, material: _material, options: _options};
  }

  //intersectsBox(box) { return this._box.intersectsBox(box); }
}