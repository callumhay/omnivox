import * as THREE from 'three';

import {SQRT2PI, spherePtToThetaPhi} from '../../MathUtils';
import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';
import Sampler from '../../Samplers';

import {VTSphereAbstract} from '../VTSphere';
import VTMaterialFactory from '../VTMaterialFactory';

const defaultSphereOptions = {
  samplesPerVoxel: 6,
};

const sigma = (2*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS) / 10.0;
const valueAtZero = (1.0 / (SQRT2PI*sigma));

class VTRPSphere extends VTSphereAbstract  {

  constructor(center, radius, material, options={...defaultSphereOptions}) {
    super(center, radius, material);
    
    // Calculate and memoize info for performing voxel sampling during rendering:
    const {samplesPerVoxel} = options;
    const maxSampleAngle = Math.asin(0.5*VoxelConstants.VOXEL_UNIT_SIZE/radius);
    const maxSampleSr = 2*Math.PI*(1-Math.cos(maxSampleAngle));
    const srPercentage = maxSampleSr / (4*Math.PI);

    this._fibSampleN = Math.ceil(samplesPerVoxel / srPercentage); // The number of sphere samples needed for fibonacci sampling
    this._samplesPerVoxel = samplesPerVoxel;

    //console.log("Steridian percent: " + srPercentage);
    //console.log("Fib Sample N: " + this._fibSampleN);
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
    const sqRadius = radius*radius;
    const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
    const voxelCenterPt = new THREE.Vector3();
    voxelBoundingBox.getCenter(voxelCenterPt);

    const centerToVoxelVec = voxelCenterPt.clone();
    centerToVoxelVec.sub(center);
    const sqDistCenterToVoxel = centerToVoxelVec.lengthSq();
    if (sqDistCenterToVoxel <= VoxelConstants.VOXEL_ERR_UNITS) { return finalColour; }

    centerToVoxelVec.normalize();

    const localSpaceSamplePt = centerToVoxelVec.clone().multiplyScalar(radius);
    const closestSamplePt = localSpaceSamplePt.clone();
    closestSamplePt.add(center);

    if (sqDistCenterToVoxel <= sqRadius && sqDistCenterToVoxel >= Math.pow(radius-1.25*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS,2)) {
      const [closestTheta, closestPhi] = spherePtToThetaPhi(radius, localSpaceSamplePt);
      const samples = [{point: closestSamplePt, normal: centerToVoxelVec, uv: null, falloff: 1}]; // Always include the closest surface point to the center of the voxel

      for (let i = 0; i < this._samplesPerVoxel; i++) {
        const samplePt = Sampler.fibSphere(i, this._fibSampleN, radius, closestTheta, closestPhi).add(center);
        if (!voxelBoundingBox.containsPoint(samplePt)) { continue; } // No sample taken if the sample point isn't inside the voxel
        const sampleNormal = samplePt.clone().sub(center).normalize();
      
        const sqrDist = samplePt.distanceToSquared(voxelCenterPt);  // Square distance from the voxel center to the sample
        const sampleFalloff = sqDistCenterToVoxel <= sqRadius ? 1 : ((1.0 / (SQRT2PI*sigma)) * Math.exp(-0.5 * (sqrDist / (2*sigma*sigma))) / valueAtZero);

        samples.push({point: samplePt, normal: sampleNormal, uv: null, falloff: sampleFalloff});
      }

      finalColour.add(scene.calculateLightingSamples(voxelIdxPt, samples, this._material));
    }

    return finalColour;
  }

}

export default VTRPSphere;