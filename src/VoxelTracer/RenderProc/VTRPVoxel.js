import * as THREE from 'three';
import VTConstants from '../VTConstants';

import VTMaterialFactory from '../VTMaterialFactory';
import VTRPObject from './VTRPObject';

import VoxelGeometryUtils from '../../VoxelGeometryUtils';

class VTRPVoxel extends VTRPObject  {
  constructor(position, material, options) {
    super(VTConstants.VOXEL_TYPE);
    this._position = position;
    this._material = material;
    this._options  = options;
    this._boundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(this._position);

    this._tempVec3 = new THREE.Vector3();
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

  dispose() { this._material.dispose(); }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }

  intersectsRay(raycaster) { return raycaster.ray.intersectsBox(this._boundingBox, this._tempVec3) !== null; }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster() && this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    // Fast-out if we can't even see this voxel
    if (!this._material.isVisible() || !scene.voxelBoundingBox.containsPoint(this._position)) { 
      return new THREE.Color(0,0,0);
    }
    return scene.calculateVoxelLighting(voxelIdxPt, this._position, this._material, this.isShadowReceiver());
  }
}

export default VTRPVoxel;