import * as THREE from 'three';

import {VTVoxelAbstract} from '../VTVoxel';
import VTMaterialFactory from '../VTMaterialFactory';

class VTRPVoxel extends VTVoxelAbstract  {
  constructor(voxelIdxPt, material, options={}) {
    super(voxelIdxPt, material, options);
  }

  static build(jsonVTVoxel) {
    const {id, drawOrder, _voxelIdxPt, _material, matrixArray, _receivesShadow} = jsonVTVoxel;
    const result = new VTRPVoxel(
      new THREE.Vector3(_voxelIdxPt.x, _voxelIdxPt.y, _voxelIdxPt.z), 
      VTMaterialFactory.build(_material), 
      {receivesShadow: _receivesShadow, matrixWorld: (new THREE.Matrix4()).fromArray(matrixArray)}
    );
    result.id = id;
    result.drawOrder = drawOrder;
    
    return result;
  }

  calculateShadow(raycaster) {
    return {
      inShadow: this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    // Fast-out if we can't even see this voxel
    if (!this._material.isVisible()) { return new THREE.Color(0,0,0); }

    this._getWorldSpacePosition(this._tempVec3);
    return scene.calculateVoxelLighting(voxelIdxPt, this._tempVec3, this._material, this._receivesShadow);
  }
}

export default VTRPVoxel;