import * as THREE from 'three';
import VTConstants from '../VTConstants';

import VTMaterialFactory from '../VTMaterialFactory';
import VTRPObject from './VTRPObject';

import VoxelGeometryUtils from '../../VoxelGeometryUtils';

const _tempVec3 = new THREE.Vector3();

class VTRPVoxel extends VTRPObject  {
  constructor(position, material, options) {
    super(VTConstants.VOXEL_TYPE);
    this._position = position;
    this._material = material;
    this._options  = options;
    this._boundingBox = new THREE.Box3();
    VoxelGeometryUtils.singleVoxelBoundingBox(this._boundingBox, this._position);
  }

  static build(jsonVTVoxel) {
    const {id, drawOrder, _position, _material, _options} = jsonVTVoxel;
    const result = new VTRPVoxel(
      new THREE.Vector3(_position.x, _position.y, _position.z), 
      VTMaterialFactory.build(_material), _options
    );
    result.id = id;
    result.drawOrder = drawOrder;
    
    return result;
  }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }

  intersectsRay(raycaster) { return raycaster.ray.intersectsBox(this._boundingBox, _tempVec3) !== null; }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster() && this.intersectsRay(raycaster),
      lightReduction: this._material.alpha, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    // Fast-out if we can't even see this voxel
    if (!this._material.isVisible() || !scene.voxelBoundingBox.containsPoint(this._position)) { return targetRGBA; }
    return scene.calculateVoxelLighting(targetRGBA, voxelIdxPt, this._position, this._material, this.isShadowReceiver());
  }
}

export default VTRPVoxel;