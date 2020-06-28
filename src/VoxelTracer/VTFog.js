
import * as THREE from 'three';
import {VOXEL_EPSILON, clamp} from '../MathUtils';
import VoxelModel from '../Server/VoxelModel';

export const fogDefaultOptions = {
  scattering: 0.1, // The amount of light reduction per voxel travelled through of the fog this must be in [0,1]
  fogColour: new THREE.Color(1,1,1),
};

class VTFog {
  constructor(minPt=new THREE.Vector3(2,2,2), maxPt=new THREE.Vector3(5,5,5), options={...fogDefaultOptions}) {
    this.boundingBox = new THREE.Box3(minPt, maxPt);
    this.options = options;

    // Temporary objects
    this._temp1Vec3 = new THREE.Vector3();
    this._temp2Vec3 = new THREE.Vector3();
  }

  dispose() {
  }

  position(target) { 
    return this.boundingBox.getCenter(target); 
  }
  setPosition(pos) {
    const size = new THREE.Vector3();
    this.boundingBox.getSize(size);
    this.boundingBox.setFromCenterAndSize(pos, size);
  }

  calculateShadow(raycaster) {
    const result = {
      inShadow: false,
      lightReduction: 0,
    };

    const {ray} = raycaster;

    // First check to see if the ray originates inside this fog
    if (this.boundingBox.containsPoint(ray.origin)) {
      // The first point is the origin of the ray
      this._temp1Vec3.copy(ray.origin);
      // The second point is where the ray intersects the bounding box of the fog
      result.inShadow = (ray.intersectBox(this.boundingBox, this._temp2Vec3) !== null);
    }
    else {
      // Calculate the distance the ray travels through this fog (if at all)
      const intersect1Result = ray.intersectBox(this.boundingBox, this._temp1Vec3);
      if (intersect1Result !== null) {
        // Find the next intersection point on the fog box using a ray whose origin is just offset 
        // from the inside of the box near the first collision point 
        const insideBoxRay = ray.clone();
        insideBoxRay.origin.set(this._temp1Vec3.x, this._temp1Vec3.y, this._temp1Vec3.z);
        insideBoxRay.origin.add(insideBoxRay.direction.clone().multiplyScalar(VOXEL_EPSILON));
        result.inShadow = (insideBoxRay.intersectBox(this.boundingBox, this._temp2Vec3) !== null);
      }
    }

    if (result.inShadow) {
      // Calculate the distance the light has travelled, use it to modulate the transimission through the fog
      result.lightReduction = this._options.scattering * this._temp1Vec3.sub(this._temp2Vec3).length();
    }

    return result;
  }

  preRender(voxelIdxPt) {} // No memoization for the fog

  calculateVoxelColour(voxelIdxPt, scene) {
    const finalColour = new THREE.Color(0,0,0);
    if (this.boundingBox.containsPoint(voxelIdxPt)) {
      const {scattering, fogColour} = this.options;

      // Fog captures light in the scene...
      const fogLighting = scene.calculateFogLighting(voxelIdxPt);
      finalColour.setRGB(
        clamp(scattering*(fogLighting.r * fogColour.r), 0, 1), 
        clamp(scattering*(fogLighting.g * fogColour.g), 0, 1), 
        clamp(scattering*(fogLighting.b * fogColour.b), 0, 1)
      );
      
    }

    return finalColour;
  }

  intersectsBox(box) {
    return this.boundingBox.intersectsBox(box);
  }

  getCollidingVoxels() {
    return VoxelModel.voxelBoxList(this.boundingBox.min, this.boundingBox.max, true);
  }
}

export default VTFog;