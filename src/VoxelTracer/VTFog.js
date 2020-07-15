
import * as THREE from 'three';
import {VOXEL_EPSILON, clamp} from '../MathUtils';
import VoxelModel from '../Server/VoxelModel';
import VTRenderable from './VTRenderable';

export const fogDefaultOptions = {
  scattering: 0.1, // The amount of light reduction per voxel travelled through of the fog this must be in [0,1]
  fogColour: new THREE.Color(1,1,1),
};

class VTFog extends VTRenderable {
  constructor(minPt=new THREE.Vector3(2,2,2), maxPt=new THREE.Vector3(5,5,5), options={...fogDefaultOptions}) {
    super(VTRenderable.FOG_TYPE);

    this._boundingBox = new THREE.Box3(minPt, maxPt);
    this._colour = options.fogColour ? options.fogColour : fogDefaultOptions.fogColour;
    this._scattering = options.scattering ? options.scattering : fogDefaultOptions.scattering;

    // Temporary objects
    this._temp1Vec3 = new THREE.Vector3();
    this._temp2Vec3 = new THREE.Vector3();

    this.makeDirty();
  }

  static build(jsonData) {
    const {id, _colour, _boundingBox, _scattering} = jsonData;
    const colour = (new THREE.Color()).setHex(_colour);
    const {min, max} = _boundingBox;
    const minPt = new THREE.Vector3(min.x, min.y, min.z);
    const maxPt = new THREE.Vector3(max.x, max.y, max.z);
    const result = new VTFog(minPt, maxPt, {fogColour: colour, scattering: _scattering});
    result.id = id;
    return result;
  }

  setBoundingBox(b) { this._boundingBox = b; this.makeDirty(); }
  setColour(c) { this._colour = c; this.makeDirty(); }
  setScattering(s) {this._scattering = s; this.makeDirty(); }

  dispose() {}

  makeDirty() { this._isDirty = true; }

  isDirty() { return this._isDirty; }

  unDirty(scene=null) {
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

  calculateShadow(raycaster) {
    const result = {
      inShadow: false,
      lightReduction: 0,
    };

    const {ray} = raycaster;

    // First check to see if the ray originates inside this fog
    if (this._boundingBox.containsPoint(ray.origin)) {
      // The first point is the origin of the ray
      this._temp1Vec3.copy(ray.origin);
      // The second point is where the ray intersects the bounding box of the fog
      result.inShadow = (ray.intersectBox(this._boundingBox, this._temp2Vec3) !== null);
    }
    else {
      // Calculate the distance the ray travels through this fog (if at all)
      const intersect1Result = ray.intersectBox(this._boundingBox, this._temp1Vec3);
      if (intersect1Result !== null) {
        // Find the next intersection point on the fog box using a ray whose origin is just offset 
        // from the inside of the box near the first collision point 
        const insideBoxRay = ray.clone();
        insideBoxRay.origin.set(this._temp1Vec3.x, this._temp1Vec3.y, this._temp1Vec3.z);
        insideBoxRay.origin.add(insideBoxRay.direction.clone().multiplyScalar(VOXEL_EPSILON));
        result.inShadow = (insideBoxRay.intersectBox(this._boundingBox, this._temp2Vec3) !== null);
      }
    }

    if (result.inShadow) {
      // Calculate the distance the light has travelled, use it to modulate the transimission through the fog
      result.lightReduction = this._scattering * this._temp1Vec3.sub(this._temp2Vec3).length();
    }

    return result;
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    const finalColour = new THREE.Color(0,0,0);
    if (this._boundingBox.containsPoint(voxelIdxPt)) {
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

  intersectsBox(box) {
    return this._boundingBox.intersectsBox(box);
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    return VoxelModel.voxelBoxList(this._boundingBox.min, this._boundingBox.max, true, voxelGridBoundingBox);
  }
}

export default VTFog;