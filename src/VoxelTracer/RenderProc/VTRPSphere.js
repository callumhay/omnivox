import * as THREE from 'three';

import {SQRT2PI, spherePtToThetaPhi} from '../../MathUtils';
import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';
import Sampler from '../../Samplers';

import {VTSphereAbstract} from '../VTSphere';
import VTMaterialFactory from '../VTMaterialFactory';

const sigma = (2*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS) / 10.0;
const valueAtZero = (1.0 / (SQRT2PI*sigma));

class VTRPSphere extends VTSphereAbstract  {

  constructor(center, radius, material, options) {
    super(center, radius, material, options);
    
    // Calculate and memoize info for performing voxel sampling during rendering:
    const {samplesPerVoxel} = options;
    const maxSampleAngle = Math.asin(0.5*VoxelConstants.VOXEL_UNIT_SIZE/radius);
    const maxSampleSr = 2*Math.PI*(1-Math.cos(maxSampleAngle));
    const srPercentage = maxSampleSr / (4*Math.PI);

    this._fibSampleN = Math.ceil(samplesPerVoxel / srPercentage); // The number of sphere samples needed for fibonacci sampling
    this._voxelIdxToSamples = {}; // Memoization for voxel collisions and sampling
  }

  static build(jsonData) {
    const {id, drawOrder, center, radius, material, options} = jsonData;
    const result = new VTRPSphere(new THREE.Vector3(center.x, center.y, center.z), radius, VTMaterialFactory.build(material), options);
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  calculateShadow(raycaster) {
    return {
      inShadow: this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    const {center, radius} = this._sphere;
    const finalColour = new THREE.Color(0,0,0);

    // Fast-out if we can't even see this sphere
    if (!this._material.isVisible() || radius <= VoxelConstants.VOXEL_EPSILON) { return finalColour; }
    
    const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
    const voxelCenterPt = new THREE.Vector3();
    voxelBoundingBox.getCenter(voxelCenterPt);

    const centerToVoxelVec = voxelCenterPt.clone();
    centerToVoxelVec.sub(center);
    const sqDistCenterToVoxel = centerToVoxelVec.lengthSq();
    if (sqDistCenterToVoxel <= VoxelConstants.VOXEL_ERR_UNITS) { 
      // Special case: We illuminate the center voxel as if it were a singluar voxel if it is the only
      // thing being rendered in this case it's an early exit and there are no samples
      return radius <= VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS ? scene.calculateVoxelLighting(voxelIdxPt, voxelCenterPt, this._material, true) : finalColour;
    }

    const voxelId = VoxelGeometryUtils.voxelFlatIdx(voxelIdxPt, scene.gridSize);
    const sphereSamples = this._preRender(voxelIdxPt, voxelId);
    if (sphereSamples.length > 0) {
      finalColour.add(scene.calculateLightingSamples(voxelIdxPt, sphereSamples, this._material));
    }

    return finalColour;
  }

  _preRender(voxelIdxPt, voxelId) {
    let samples = null;
    // Have we memoized the current voxel index point yet?
    if (voxelId in this._voxelIdxToSamples) {
      samples = this._voxelIdxToSamples[voxelId]; // Just use the memoized values...
    }
    else {
      samples = [];

      const {center, radius} = this._sphere;
      const sqRadius = radius*radius;
      const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
      const voxelCenterPt = new THREE.Vector3();
      voxelBoundingBox.getCenter(voxelCenterPt);

      const centerToVoxelVec = voxelCenterPt.clone();
      centerToVoxelVec.sub(center);
      const sqDistCenterToVoxel = centerToVoxelVec.lengthSq();

      if (sqDistCenterToVoxel <= VoxelConstants.VOXEL_ERR_UNITS || radius <= VoxelConstants.VOXEL_EPSILON) { 
        return samples; // The voxel is either empty or the sphere is rendered as a single point/voxel - either way, there are no samples
      }

      centerToVoxelVec.normalize();

      const localSpaceSamplePt = centerToVoxelVec.clone().multiplyScalar(radius);
      const closestSamplePt = localSpaceSamplePt.clone();
      closestSamplePt.add(center);

      if (sqDistCenterToVoxel <= sqRadius) {
        const {samplesPerVoxel, fill} = this._options;

        if (sqDistCenterToVoxel >= Math.pow(radius-1.25*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS,2)) {
          const [closestTheta, closestPhi] = spherePtToThetaPhi(radius, localSpaceSamplePt);
          samples.push({point: closestSamplePt, normal: centerToVoxelVec, uv: null, falloff: 1}); // Always include the closest sample
          for (let i = 0; i < samplesPerVoxel; i++) {
            const samplePt = Sampler.fibSphere(i, this._fibSampleN, radius, closestTheta, closestPhi).add(center);
            if (!voxelBoundingBox.containsPoint(samplePt)) { continue; } // No sample taken if the sample point isn't inside the voxel
            const sampleNormal = samplePt.clone().sub(center).normalize();
          
            const sqrDist = samplePt.distanceToSquared(voxelCenterPt);  // Square distance from the voxel center to the sample
            const sampleFalloff = sqDistCenterToVoxel <= sqRadius ? 1 : ((1.0 / (SQRT2PI*sigma)) * Math.exp(-0.5 * (sqrDist / (2*sigma*sigma))) / valueAtZero);

            samples.push({point: samplePt, normal: sampleNormal, uv: null, falloff: sampleFalloff});
          }
        }
        else if (fill) {
          samples.push({point: closestSamplePt, normal: centerToVoxelVec, uv: null, falloff: 1});
        } 
      }

      this._voxelIdxToSamples[voxelId] = samples;
    }

    return samples;
  }

}

export default VTRPSphere;