
import * as THREE from 'three';
import {VOXEL_EPSILON, clamp} from '../MathUtils';

export const fogDefaultOptions = {
  scattering: 0.1, // The amount of light reduction per voxel travelled through of the fog
  fogColour: new THREE.Color(1,1,1),
};

class VTFog {
  constructor(minPt=new THREE.Vector3(2,2,2), maxPt=new THREE.Vector3(5,5,5), options=fogDefaultOptions) {
    this.boundingBox = new THREE.Box3(minPt, maxPt);
    this._options = options;

    // Temporary objects
    this._temp1Vec3 = new THREE.Vector3();
    this._temp2Vec3 = new THREE.Vector3();
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

    // Calculate the distance the ray travels through this fog (if at all)
    const intersect1Result = raycaster.ray.intersectBox(this.boundingBox, this._temp1Vec3);
    if (intersect1Result !== null) {
      // Find the next intersection point on the fog box using a ray whose origin is just offset 
      // from the inside of the box near the first collision point 
      const insideBoxRay = raycaster.ray.clone();
      insideBoxRay.origin.set(this._temp1Vec3.x, this._temp1Vec3.y, this._temp1Vec3.z);
      insideBoxRay.origin.add(insideBoxRay.direction.clone().multiplyScalar(VOXEL_EPSILON));

      insideBoxRay.intersectBox(this.boundingBox, this._temp2Vec3);

      // Calculate the distance between the two intersections, use it to modulate the transimission through the fog
      result.lightReduction = this._options.scattering * this._temp1Vec3.sub(this._temp2Vec3).length();
      result.inShadow = true;
    }

    return result;
  }

  calculateVoxelColour(voxelIdxPt, scene=null) {
    const finalColour = new THREE.Color(0,0,0);
    if (this.boundingBox.containsPoint(voxelIdxPt)) {
      const {scattering, fogColour} = this._options;
      finalColour.setRGB(clamp(scattering*fogColour.r,0,1), clamp(scattering*fogColour.g,0,1), clamp(scattering*fogColour.b,0,1));
    }

    return finalColour;
  }

  intersectsBox(box) {
    return this.boundingBox.intersectsBox(box);
  }

  getCollidingVoxels(voxelModel) {
    return voxelModel.voxelBoxList(this.boundingBox.min, this.boundingBox.max, true);
  }
}

export default VTFog;