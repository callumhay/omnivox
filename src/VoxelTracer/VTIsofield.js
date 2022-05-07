import * as THREE from 'three';
import InitUtils from '../InitUtils';

import VoxelConstants from '../VoxelConstants';
import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTMaterialFactory from './VTMaterialFactory';
import VTObject from './VTObject';

const _minPt = new THREE.Vector3(0,0,0);

export const defaultIsofieldOptions = {
  receivesShadows: true,
  castsShadows: true,
}

class VTIsofield extends VTObject {
  constructor(size, material, options) {
    super(VTConstants.ISOFIELD_TYPE);
    this._size = InitUtils.initValue(size, VoxelConstants.VOXEL_GRID_SIZE);
    this._material = VTMaterialFactory.initMaterial(material);
    this._options = options ? {...defaultIsofieldOptions, ...options} : {...defaultIsofieldOptions};
    this._maxPt = new THREE.Vector3(size-1,size-1,size-1);
    this.reset();
  }

  get material() { return this._material; }

  get options() { return this._options; }
  setOptions(o) { this._options = {...this._options, ...o}; this.makeDirty(); return this; }

  toJSON() {
    const {id, drawOrder, type, _material, _size, _metaballs, _walls, _options} = this;
    return {id, drawOrder, type, _material, _size, _metaballs, _walls, _options};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelAABBList(_minPt, this._maxPt, true, voxelGridBoundingBox);
  }

  reset() {
    if (this._metaballs && this._metaballs.length === 0 && this._walls && this._walls.length === 0) { return; }
    this._metaballs = [];
    this._walls = {};
    this.makeDirty();
  }

  // Much of this code comes from the three.js metaball/marching cube example:
  // https://github.com/mrdoob/three.js/blob/master/examples/jsm/objects/MarchingCubes.js
  addMetaball(ballX, ballY, ballZ, strength, subtract, colour) {
    this._metaballs.push({ballX, ballY, ballZ, strength, subtract, colour});
    this.makeDirty();
  }

  addWallX(strength, subtract) { this._addWall('x', strength, subtract); }
  addWallY(strength, subtract) { this._addWall('y', strength, subtract); }
  addWallZ(strength, subtract) { this._addWall('z', strength, subtract); }

  _addWall(wallType, strength, subtract) {
    let wallObj = null;
    if ((wallType in this._walls)) { 
      wallObj = this._walls[wallType]; 
      if (wallObj && wallObj.strength === strength && wallObj.subtract === subtract) { return wallObj; } // nothing has changed
      wallObj.strength = strength;
      wallObj.subtract = subtract;
    }
    else {
      wallObj = this._walls[wallType] = {strength, subtract};
    }

    this.makeDirty();
    return wallObj;
  }
};

export default VTIsofield;