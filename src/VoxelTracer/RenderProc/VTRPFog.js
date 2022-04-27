import * as THREE from 'three';

import {clamp} from '../../MathUtils';

import VTConstants from '../VTConstants';

import VTRPObject from './VTRPObject';

class VTRPFog extends VTRPObject {
  constructor(type) {
    super(type);
    this._colour = new THREE.Color();
    this._scattering = 0;
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {id, drawOrder, _colour, _scattering} = json;
    this.id = id;
    this.drawOrder = drawOrder;
    this._colour.setHex(_colour);
    this._scattering = _scattering;
    return this;
  }

  isShadowCaster() { return false; }
  isShadowReceiver() { return false; }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster(),
      lightReduction: 0,
    };
  }

  _calcVoxelColourWithShape(targetRGBA, voxelIdxPt, shape, scene) {
    if (shape.containsPoint(voxelIdxPt)) {
      // Fog captures light in the scene...
      scene.calculateFogLighting(targetRGBA, voxelIdxPt);
      targetRGBA.setRGB(
        clamp(this._scattering*(targetRGBA.r * this._colour.r), 0, 1), 
        clamp(this._scattering*(targetRGBA.g * this._colour.g), 0, 1), 
        clamp(this._scattering*(targetRGBA.b * this._colour.b), 0, 1)
      );
    }
    return targetRGBA;
  }
}

export class VTRPFogBox extends VTRPFog {
  constructor() {
    super(VTConstants.FOG_BOX_TYPE);
    this._boundingBox = new THREE.Box3();

  }

  fromJSON(json, pool) {
    super.fromJSON(json, pool);
    const {_boundingBox} = json;
    this._boundingBox.copy(_boundingBox);
    return this;
  }

  position(target) { 
    return this._boundingBox.getCenter(target); 
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    return this._calcVoxelColourWithShape(targetRGBA, voxelIdxPt, this._boundingBox, scene);
  }
}

export class VTRPFogSphere extends VTRPFog {
  constructor() {
    super(VTConstants.FOG_SPHERE_TYPE);
    this._boundingSphere = new THREE.Sphere();
  }

  fromJSON(json, pool) {
    super.fromJSON(json, pool);
    const {_boundingSphere} = json;
    this._boundingSphere.copy(_boundingSphere);
    return this;
  }

  position(target) { 
    return target.copy(this._boundingSphere.center); 
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    return this._calcVoxelColourWithShape(targetRGBA, voxelIdxPt, this._boundingSphere, scene);
  }
}
