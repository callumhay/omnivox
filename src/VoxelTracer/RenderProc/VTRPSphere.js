import * as THREE from 'three';

import {SQRT2PI, spherePtToThetaPhi} from '../../MathUtils';
import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';
import Sampler from '../../Samplers';

import VTConstants from '../VTConstants';
import VTPool from '../VTPool';
import {defaultSphereOptions} from '../VTSphere';

import VTRPObject from './VTRPObject';
import VTRPObjectFactory from './VTRPObjectFactory';
import VTRPSample from './VTRPSample';

const sigma = (2*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS) / 10.0;
const valueAtZero = (1.0 / (SQRT2PI*sigma));

const _tempBox = new THREE.Box3();
const _tempVec3 = new THREE.Vector3();
const _voxelCenterPt = new THREE.Vector3();
const _localSpaceSamplePt = new THREE.Vector3();
const _closestSamplePt = new THREE.Vector3();
const _centerToVoxelVec = new THREE.Vector3();

const _samplePool = new VTPool();

class VTRPSphere extends VTRPObject  {

  constructor() {
    super(VTConstants.SPHERE_TYPE);
    this._sphere = new THREE.Sphere();
    this._material = null;
    this._options = {...defaultSphereOptions};
  }

  reinit() {
    // Calculate and memoize info for performing voxel sampling during rendering:
    const maxSampleAngle = Math.asin(0.5*VoxelConstants.VOXEL_UNIT_SIZE/this._sphere.radius);
    const maxSampleSr = 2*Math.PI*(1-Math.cos(maxSampleAngle));
    const srPercentage = maxSampleSr / (4*Math.PI);
    
    this._fibSampleN = Math.ceil(this._options.samplesPerVoxel / srPercentage); // The number of sphere samples needed for fibonacci sampling
    this._voxelIdxToSamples = {}; // Memoization for voxel sampling
  }

  expire(pool) {
    if (this._material) {
      pool.expire(this._material);
      this._material = null;
    }
    // Clean up the samples as well
    for (const samples of Object.values(this._voxelIdxToSamples)) {
      for (const sample of samples) {
        _samplePool.expire(sample);
      }
    }
  }

  fromJSON(json, pool) {
    const {id, drawOrder, center, radius, material, options} = json;
    this.id = id;
    this.drawOrder = drawOrder;

    // NOTE: For now the world transform is done on the main thread to the center and radius
    //this._matrixWorld.fromArray(matrixWorld); 
    //this._invMatrixWorld.fromArray(invMatrixWorld);

    this._sphere.set(center, radius);
    this._options = {...this._options, ...options};
    this._material = VTRPObjectFactory.updateOrBuildFromPool(material, pool, this._material);

    this.reinit();
    return this;
  }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }

  intersectsRay(raycaster) {
    const {ray, far} = raycaster;
    this._sphere.radius -= VoxelConstants.VOXEL_EPSILON;
    const intersectionPt = ray.intersectSphere(this._sphere, _tempVec3);
    this._sphere.radius += VoxelConstants.VOXEL_EPSILON;

    // Is the intersection point inside the sphere?
    return intersectionPt !== null && intersectionPt.distanceToSquared(ray.origin) <= far*far;
  }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster() && this.intersectsRay(raycaster),
      lightReduction: this._material.alpha, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    const {center, radius} = this._sphere;

    // Fast-out if we can't even see this sphere
    if (!this._material.isVisible() || radius <= VoxelConstants.VOXEL_EPSILON) { return targetRGBA; }
    
    VoxelGeometryUtils.voxelCenterPt(_voxelCenterPt, voxelIdxPt);
    _centerToVoxelVec.copy(_voxelCenterPt).sub(center);

    const sqDistCenterToVoxel = _centerToVoxelVec.lengthSq();
    if (sqDistCenterToVoxel <= VoxelConstants.VOXEL_ERR_UNITS) { 
      // Special case: We illuminate the center voxel as if it were a singluar voxel if it is the only
      // thing being rendered in this case it's an early exit and there are no samples
      return radius <= VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS ? 
        scene.calculateVoxelLighting(targetRGBA, voxelIdxPt, _voxelCenterPt, this._material, true) : targetRGBA;
    }

    const voxelId = VoxelGeometryUtils.voxelFlatIdx(voxelIdxPt, scene.gridSize);
    const sphereSamples = this._preRender(voxelIdxPt, voxelId, _voxelCenterPt);
    if (sphereSamples.length > 0) {
      scene.calculateLightingSamples(targetRGBA, voxelIdxPt, sphereSamples, this._material);
    }

    return targetRGBA;
  }

  _preRender(voxelIdxPt, voxelId, voxelCenterPt) {
    let samples = null;
    // Have we memoized the current voxel index point yet?
    if (voxelId in this._voxelIdxToSamples) {
      samples = this._voxelIdxToSamples[voxelId]; // Just use the memoized values...
    }
    else {
      samples = [];

      const {center, radius} = this._sphere;
      const sqRadius = radius*radius;
      
      const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(_tempBox, voxelIdxPt);
      _centerToVoxelVec.copy(voxelCenterPt).sub(center);
      const sqDistCenterToVoxel = _centerToVoxelVec.lengthSq();

      if (sqDistCenterToVoxel <= VoxelConstants.VOXEL_ERR_UNITS || radius <= VoxelConstants.VOXEL_EPSILON) { 
        this._voxelIdxToSamples[voxelId] = samples;
        return samples; // The voxel is either empty or the sphere is rendered as a single point/voxel - either way, there are no samples
      }

      _centerToVoxelVec.normalize();
      _localSpaceSamplePt.copy(_centerToVoxelVec).multiplyScalar(radius);
      _closestSamplePt.copy(_localSpaceSamplePt).add(center);

      if (sqDistCenterToVoxel <= sqRadius) {
        const {samplesPerVoxel, fill} = this._options;

        if (sqDistCenterToVoxel >= Math.pow(radius-1.25*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS,2)) {

          // Always include the closest sample
          const [closestTheta, closestPhi] = spherePtToThetaPhi(radius, _localSpaceSamplePt);
          samples.push(_samplePool.get(VTRPSample).set(_closestSamplePt, _centerToVoxelVec, null, 1));

          // For emissive materials we only need one sample... TODO: Texture mapping will require avg of uvs
          const emissionOnly = this._material.isEmissionOnly();
          if (!emissionOnly) {
            for (let i = 0; i < samplesPerVoxel; i++) {
              const samplePt = Sampler.fibSphere(_tempVec3, i, this._fibSampleN, radius, closestTheta, closestPhi).add(center);
              if (!voxelBoundingBox.containsPoint(samplePt)) { continue; } // No sample taken if the sample point isn't inside the voxel

              const sample = _samplePool.get(VTRPSample);
              sample.point.copy(samplePt);
              sample.normal.copy(samplePt).sub(center).normalize();

              const sqrDist = samplePt.distanceToSquared(voxelCenterPt);  // Square distance from the voxel center to the sample
              sample.falloff = sqDistCenterToVoxel <= sqRadius ? 1 : ((1.0 / (SQRT2PI*sigma)) * Math.exp(-0.5 * (sqrDist / (2*sigma*sigma))) / valueAtZero);

              samples.push(sample);
            }
          }
        }
        else if (fill) {
          samples.push(_samplePool.get(VTRPSample).set(_closestSamplePt, _centerToVoxelVec, null, 1));
        } 
      }

      this._voxelIdxToSamples[voxelId] = samples;
    }

    return samples;
  }

}

export default VTRPSphere;