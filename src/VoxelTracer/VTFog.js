
import * as THREE from 'three';
import VoxelModel from '../Server/VoxelModel';

import VTObject from './VTObject';

export const fogDefaultOptions = {
  scattering: 0.1, // The amount of light reduction per voxel travelled through of the fog this must be in [0,1]
  fogColour: new THREE.Color(1,1,1),
};

class VTFog extends VTObject {
  constructor(minPt=new THREE.Vector3(2,2,2), maxPt=new THREE.Vector3(5,5,5), options={...fogDefaultOptions}) {
    super(VTObject.FOG_TYPE);

    this._boundingBox = new THREE.Box3(minPt, maxPt);
    this._colour = options.fogColour ? options.fogColour : fogDefaultOptions.fogColour;
    this._scattering = options.scattering ? options.scattering : fogDefaultOptions.scattering;

    this.makeDirty();
  }

  setBoundingBox(b) { this._boundingBox = b; this.makeDirty(); }
  setColour(c) { this._colour = c; this.makeDirty(); }
  setScattering(s) {this._scattering = s; this.makeDirty(); }

  dispose() {}

  makeDirty() { this._isDirty = true; }

  isDirty() { return this._isDirty; }

  unDirty() {
    if (this._isDirty) {
      this._isDirty = false;
      return true;
    }
    return false;
  }

  isShadowCaster() { return true; }

  toJSON() {
    const {id, type, _colour, _boundingBox, _scattering} = this;
    return {id, type, _colour, _boundingBox, _scattering};
  }

  position(target) { 
    return this._boundingBox.getCenter(target); 
  }
  setPosition(pos) {
    const size = new THREE.Vector3();
    this._boundingBox.getSize(size);
    this._boundingBox.setFromCenterAndSize(pos, size);
  }

  intersectsBox(box) {
    return this._boundingBox.intersectsBox(box);
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelModel.voxelBoxList(this._boundingBox.min, this._boundingBox.max, true, voxelGridBoundingBox);
  }
}

export default VTFog;