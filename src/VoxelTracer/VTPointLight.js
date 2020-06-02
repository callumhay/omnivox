import * as THREE from 'three';

export const defaultAttenuation = {
  quadratic:0, 
  linear:1, 
};

class VTPointLight {
  constructor(position, colour, attenuation=defaultAttenuation) {
    this.position = position;
    this.colour = colour ? colour : new THREE.Color(1,1,1);
    this.attenuation = attenuation;
  }

  dispose() {}

  emission(distance) {
    // TODO: This can blow out a colour... maybe map it to a spectrum or something when we want to get fancy?
    const emissionColour = this.colour.clone().multiplyScalar(this.calculateAttenuation(distance));
    emissionColour.setRGB(emissionColour.r, emissionColour.g, emissionColour.b);
    return emissionColour;
  }

  calculateAttenuation(distance) {
    return 1.0 / (this.attenuation.quadratic*distance*distance + this.attenuation.linear*distance + 1.0); // Always in [0,1]
  }

  calculateVoxelColour(voxelPt, scene=null) {
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

  getCollidingVoxels() {
    // Just return the nearest voxel to this light (since it's a point light it will only be a single voxel)
    return [VoxelModel.closestVoxelIdxPt(this.position)];
  }
}

export default VTPointLight;