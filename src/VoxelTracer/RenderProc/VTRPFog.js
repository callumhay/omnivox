import * as THREE from 'three';

import {clamp} from '../../MathUtils';

import VTConstants from '../VTConstants';

import VTRPObject from './VTRPObject';

class VTRPFog extends VTRPObject {
  constructor(type, options) {
    super(type);
    this._colour = options.colour ? options.colour : fogDefaultOptions.colour;
    this._scattering = options.scattering ? options.scattering : fogDefaultOptions.scattering;
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
  constructor(boundingBox, options) {
    super(VTConstants.FOG_BOX_TYPE, options);
    this._boundingBox = boundingBox;
  }

  static build(json) {
    const {id, drawOrder, _colour, _boundingBox, _scattering} = json;
    const colour = (new THREE.Color()).setHex(_colour);
    const {min, max} = _boundingBox;
    const minPt = new THREE.Vector3(min.x, min.y, min.z);
    const maxPt = new THREE.Vector3(max.x, max.y, max.z);
    const result = new VTRPFogBox(new THREE.Box3(minPt, maxPt), {colour: colour, scattering: _scattering});
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  position(target) { 
    return this._boundingBox.getCenter(target); 
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    return this._calcVoxelColourWithShape(targetRGBA, voxelIdxPt, this._boundingBox, scene);
  }
}

export class VTRPFogSphere extends VTRPFog {
  constructor(boundingSphere, options) {
    super(VTConstants.FOG_SPHERE_TYPE, options);
    this._boundingSphere = boundingSphere;
  }

  static build(json) {
    const {id, drawOrder, _colour, _boundingSphere, _scattering} = json;
    const colour = (new THREE.Color()).setHex(_colour);
    const {center, radius} = _boundingSphere;
    const c = new THREE.Vector3(center.x, center.y, center.z);
    const result = new VTRPFogSphere(new THREE.Sphere(c, radius), {colour: colour, scattering: _scattering});
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  position(target) { 
    return target.copy(this._boundingSphere.center); 
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    return this._calcVoxelColourWithShape(targetRGBA, voxelIdxPt, this._boundingSphere, scene);
  }
}
