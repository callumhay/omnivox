
import * as THREE from 'three';
import InitUtils from '../InitUtils';

import VoxelGeometryUtils from '../VoxelGeometryUtils';
import VTConstants from './VTConstants';
import VTObject from './VTObject';

export const fogDefaultOptions = {
  scattering: 0.1, // The amount of light reduction per voxel travelled through of the fog this must be in [0,1]
  colour: new THREE.Color(1,1,1),
};

class VTFog extends VTObject {
  constructor(type, options) {
    super(type);
    const {colour:defaultColour, scattering:defaultScattering} = fogDefaultOptions;
    this._colour = new THREE.Color(defaultColour.r, defaultColour.g, defaultColour.b);
    if (options.colour) { this._colour.copy(options.colour);}
    this._scattering = InitUtils.initValue(options.scattering, defaultScattering);
  }

  toJSON() {
    const {id, drawOrder, type, _colour, _scattering} = this;
    return {id, drawOrder, type, _colour, _scattering};
  }
}

export class VTFogBox extends VTFog {
  constructor(minPt, maxPt, options={...fogDefaultOptions}) {
    super(VTConstants.FOG_BOX_TYPE, options);
    this._boundingBox = new THREE.Box3();
    this._boundingBox.set(minPt, maxPt);
    this.makeDirty();
  }

  position(target) { 
    return this._boundingBox.getCenter(target); 
  }
  setPosition(pos) {
    const size = new THREE.Vector3();
    this._boundingBox.getSize(size);
    this._boundingBox.setFromCenterAndSize(pos, size);
    this.makeDirty();
  }

  toJSON() {
    const parentJson = super.toJSON();
    const {_boundingBox} = this;
    return {...parentJson, _boundingBox};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelAABBList(this._boundingBox.min, this._boundingBox.max, true, voxelGridBoundingBox);
  }
}

export class VTFogSphere extends VTFog {
  constructor(center, radius=8, options={...fogDefaultOptions}) {
    super(VTConstants.FOG_SPHERE_TYPE, options);
    this._boundingSphere = new THREE.Sphere();
    this._boundingSphere.set(center, radius);
    this.makeDirty();
  }

  setRadius(r) { 
    this._boundingSphere.set(this._boundingSphere.center, r);
    this.makeDirty();
  }

  position(target) { 
    return target.copy(this._boundingSphere.center); 
  }
  setPosition(pos) {
    this._boundingSphere.set(pos, this._boundingSphere.radius);
    this.makeDirty();
  }

  toJSON() {
    const parentJson = super.toJSON();
    const {_boundingSphere} = this;
    return {...parentJson, _boundingSphere};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelSphereList(this._boundingSphere.center, this._boundingSphere.radius, true, voxelGridBoundingBox);
  }
}
