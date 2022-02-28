
import * as THREE from 'three';

import {clamp} from '../../MathUtils';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';

import VTObject from '../VTObject';

class VTRPFog extends VTObject {
  constructor(type, options) {
    super(type);
    this._colour = options.fogColour ? options.fogColour : fogDefaultOptions.fogColour;
    this._scattering = options.scattering ? options.scattering : fogDefaultOptions.scattering;
  }

  dispose() {}

  isShadowCaster() { return false; }

  // NOT CURRENTLY IN USE.
  calculateShadow(raycaster) {
    const result = {
      inShadow: false,
      lightReduction: 0,
    };
    return result;
  }

  _calcVoxelColourWithShape(voxelIdxPt, shape, scene) {
    const finalColour = new THREE.Color(0,0,0);
    if (shape.containsPoint(voxelIdxPt)) {
      // Fog captures light in the scene...
      const fogLighting = scene.calculateFogLighting(voxelIdxPt);
      finalColour.setRGB(
        clamp(this._scattering*(fogLighting.r * this._colour.r), 0, 1), 
        clamp(this._scattering*(fogLighting.g * this._colour.g), 0, 1), 
        clamp(this._scattering*(fogLighting.b * this._colour.b), 0, 1)
      );
      
    }
    return finalColour;
  }
}

export class VTRPFogBox extends VTRPFog {
  constructor(boundingBox, options) {
    super(VTObject.FOG_BOX_TYPE, options);
    this._boundingBox = boundingBox;
  }

  static build(json) {
    const {id, drawOrder, _colour, _boundingBox, _scattering} = json;
    const colour = (new THREE.Color()).setHex(_colour);
    const {min, max} = _boundingBox;
    const minPt = new THREE.Vector3(min.x, min.y, min.z);
    const maxPt = new THREE.Vector3(max.x, max.y, max.z);
    const result = new VTRPFogBox(new THREE.Box3(minPt, maxPt), {fogColour: colour, scattering: _scattering});
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  position(target) { 
    return this._boundingBox.getCenter(target); 
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    return this._calcVoxelColourWithShape(voxelIdxPt, this._boundingBox, scene);
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelAABBList(this._boundingBox.min, this._boundingBox.max, true, voxelGridBoundingBox);
  }
}

export class VTRPFogSphere extends VTRPFog {
  constructor(boundingSphere, options) {
    super(VTObject.FOG_SPHERE_TYPE, options);
    this._boundingSphere = boundingSphere;
  }

  static build(json) {
    const {id, drawOrder, _colour, _boundingSphere, _scattering} = json;
    const colour = (new THREE.Color()).setHex(_colour);
    const {center, radius} = _boundingSphere;
    const c = new THREE.Vector3(center.x, center.y, center.z);
    const result = new VTRPFogSphere(new THREE.Sphere(c, radius), {fogColour: colour, scattering: _scattering});
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  position(target) { 
    return target.copy(this._boundingSphere.center); 
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    return this._calcVoxelColourWithShape(voxelIdxPt, this._boundingSphere, scene);
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelGeometryUtils.voxelSphereList(this._boundingSphere.center, this._boundingSphere.radius, true, voxelGridBoundingBox);
  }
}
