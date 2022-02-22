import * as THREE from 'three';

import {SQRT2PI} from '../../MathUtils';
import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';

import {VTSphereAbstract} from '../VTSphere';
import VTMaterialFactory from '../VTMaterialFactory';

const defaultSphereOptions = {
  samplesPerVoxel: 6,
}

class VTRPSphere extends VTSphereAbstract  {

  constructor(center, radius, material, options={...defaultSphereOptions}) {
    super(center, radius, material);
    
    // Calculate and memoize info for performing voxel sampling during rendering:
    const {samplesPerVoxel} = options;
    const maxSampleAngle = Math.asin(0.5*VoxelConstants.VOXEL_UNIT_SIZE/radius); // *2
    const anglePct = maxSampleAngle / Math.PI; // *2
    this._fibSampleN = Math.ceil(samplesPerVoxel / anglePct); // The number of sphere samples needed for fibonacci sampling
    this._samplesPerVoxel = samplesPerVoxel;
  }

  static build(jsonData) {
    const {id, center, radius, material} = jsonData;
    const result = new VTRPSphere(new THREE.Vector3(center.x, center.y, center.z), radius, VTMaterialFactory.build(material));
    result.id = id;
    return result;
  }

  calculateShadow(raycaster) {
    return {
      inShadow: this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    const finalColour = new THREE.Color(0,0,0);
    // Fast-out if we can't even see this sphere
    if (!this._material.isVisible()) { return finalColour; }

    const {center, radius} = this._sphere;
    const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
    const voxelCenterPt = new THREE.Vector3();
    voxelBoundingBox.getCenter(voxelCenterPt);

    const centerToVoxelVec = voxelCenterPt.clone();
    centerToVoxelVec.sub(center);
    const distCenterToVoxel = centerToVoxelVec.length();
    centerToVoxelVec.divideScalar(distCenterToVoxel);

    const closestSamplePt = centerToVoxelVec.clone().multiplyScalar(radius);
    closestSamplePt.add(center);


    /*
    if (voxelBoundingBox.containsPoint(closestSamplePt)) {
      const [closestTheta, closestPhi] = spherePtToThetaPhi(radius, closestSamplePt);

      const samples = [];
      for (let i = 0; i < this._samplesPerVoxel; i++) {
        const samplePt = Sampler.fibSphere(i, this._fibSampleN, radius, closestTheta, closestPhi);
        const sqrDist = samplePt.distanceToSquared(voxelCenterPt);  // Square distance from the voxel center to the sample
        const sampleNormal = samplePt.clone().sub(center).normalize();
        const sampleFalloff = 
        samples.push({point: samplePt, normal: sampleNormal, uv: null, falloff: sampleFalloff});

      }

    }
    else {
      // If the closest possible point on the sphere's surface is not inside the current voxel, 
      // we may still render something in this voxel.
      // In order to preserve the appearance of the sphere's surface at a proper level of brightness:
      // If the surface is barely touching the next voxel outward then we will want to render this voxel.


    }
    */


    // The interval here is pretty finicky... only sampling a single point is the issue. The proper solution is
    // to do multi sub-voxel sampling i.e., monte carlo (+ importance sampling would be the best solution)...
    // That would definitely be more expensive. I'm also lazy.
    if (distCenterToVoxel <= radius+VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS && distCenterToVoxel >= radius-1.5*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS) {

      // Find the square distance from the voxel center to the actual sphere boundary sample
      const sqrDist = closestSamplePt.distanceToSquared(voxelCenterPt);

      // If we're inside/on the boundary of the sphere we set a full falloff,
      // otherwise it's outside - in this case we use a gaussian falloff to dim the voxel.
      const sigma = VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS / 10.0;
      const valueAtZero = (1.0 / SQRT2PI*sigma);
      const falloff = distCenterToVoxel <= (radius+VoxelConstants.VOXEL_EPSILON) ?  1.0 : ((1.0 / SQRT2PI*sigma) * Math.exp(-0.5 * (sqrDist / (2*sigma*sigma))) / valueAtZero);

      // Create a sample and calculate its contribution to the voxel colour
      const sample = { point: closestSamplePt, normal: centerToVoxelVec, uv: null, falloff };
      finalColour.add(scene.calculateLightingSamples(voxelIdxPt, [sample], this._material));
    }

    return finalColour;
  }

}

export default VTRPSphere;