import * as THREE from 'three';
import {VOXEL_EPSILON, clamp} from '../MathUtils';

export const defaultAttenuation = {
  quadratic:0, 
  linear:1, 
  constant:0
};

class VTPointLight {
  constructor(position, colour, attenuation=defaultAttenuation) {
    this.position = position;
    this.colour = colour ? colour : new THREE.Color(1,1,1);
    this.attenuation = attenuation;
  }

  emission(distance) {
    const emissionColour = this.colour.clone().multiplyScalar(this.calculateAttenuation(distance));
    emissionColour.setRGB(clamp(emissionColour.r, 0, 1), clamp(emissionColour.g, 0, 1), clamp(emissionColour.b, 0, 1));
    return emissionColour;
  }

  calculateAttenuation(distance) {
    const d = Math.max(VOXEL_EPSILON, distance);
    return this.attenuation.quadratic/(d*d) + this.attenuation.linear/d + this.attenuation.constant;
  }

  calculateVoxelColour(voxelPt, scene) {
    const d = this.position.distanceTo(voxelPt);
    return this.emission(d);
  }

  intersectsBox(voxelBoundingBox) {
    return this.boundingSphere().intersectsBox(voxelBoundingBox);
  }

  boundingBox() {
    const minPos = this.position.clone().subScalar(0.5);
    const maxPos = this.position.clone().addScalar(0.5);
    return new THREE.Box3(minPos, maxPos);
  }

  boundingSphere() {
    return new THREE.Sphere(this.position.clone(), 0.5);
  }

  getCollidingVoxels(voxelModel) {
    // Just return the nearest voxel to this light (since it's a point light it will only be a single voxel)
    return [voxelModel.closestVoxel(this.position)];
  }
}

export default VTPointLight;