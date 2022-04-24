import * as THREE from 'three';

import VTMaterialFactory from '../VTMaterialFactory';

import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';

import VTConstants from '../VTConstants';

import VTRPObject from './VTRPObject';

//import {HALTON_5PTS_SEQ_2_3_5} from '../../Samplers';

const nX = new THREE.Vector3(1,0,0);
const nY = new THREE.Vector3(0,1,0);
const nZ = new THREE.Vector3(0,0,1);

const SAMPLE_THRESHOLD = VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS;

class VTRPBox extends VTRPObject {
  constructor(minPt, maxPt, matrixWorld, material, options) {
    super(VTConstants.BOX_TYPE);

    this._matrixWorld = matrixWorld.clone();
    this._invMatrixWorld = matrixWorld.invert();

    this._box = new THREE.Box3(minPt, maxPt); // The non-transformed box

    this._material = material;
    this._options  = options;

    this._tempVec3_0 = new THREE.Vector3();
    this._tempVec3_1 = new THREE.Vector3();
    this._tempVec3_2 = new THREE.Vector3();
    this._tempRay = new THREE.Ray();

    //this._samplePts = [];
    //for (let i = 0; i < 5; i++) { this._samplePts.push(new THREE.Vector3()); }

    // Build the wall planes that make up the sides of this box in worldspace
    this._boxPlanes = [];
    if (!this._box.isEmpty()) {
      const {min, max} = this._box;
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, this._tempVec3_0.copy(min).add(nY), this._tempVec3_1.copy(min).add(nX)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, this._tempVec3_0.copy(max).sub(nX), this._tempVec3_1.copy(max).sub(nY)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, this._tempVec3_0.copy(min).add(nX), this._tempVec3_1.copy(min).add(nZ)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, this._tempVec3_0.copy(max).sub(nZ), this._tempVec3_1.copy(max).sub(nX)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, this._tempVec3_0.copy(min).add(nZ), this._tempVec3_1.copy(min).add(nY)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, this._tempVec3_0.copy(max).sub(nY), this._tempVec3_1.copy(max).sub(nZ)));
    }
    const normalMatrix = (new THREE.Matrix3()).getNormalMatrix(this._matrixWorld)
    for (const plane of this._boxPlanes) { plane.applyMatrix4(this._matrixWorld, normalMatrix); }
  }

  dispose() { this._material.dispose(); }

  static build(jsonData) {
    const {id, drawOrder, matrixWorld, min, max, material, options} = jsonData;
    const result = new VTRPBox(
      new THREE.Vector3(min.x, min.y, min.z), 
      new THREE.Vector3(max.x, max.y, max.z),
      (new THREE.Matrix4()).fromArray(matrixWorld),
      VTMaterialFactory.build(material), options
    );
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }
  isFilled() { return this._options.fill || false; }

  intersectsRay(raycaster) { 
    // Move the ray into local space and check if it collides with the local space box
    this._tempRay.copy(raycaster.ray);
    this._tempRay.applyMatrix4(this._invMatrixWorld);
    return this._tempRay.intersectsBox(this._box);
  }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster() && this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
    const voxelCenterPt = voxelBoundingBox.getCenter(this._tempVec3_0);

    // Fast-out if we can't even see this box 
    if (!this._material.isVisible() || this._boxPlanes.length === 0) { return targetRGBA; }

    // ... also check whether the voxel point isn't inside this box
    const planeSignedDistances = [];
    for (const plane of this._boxPlanes) {
      const signedDist = plane.distanceToPoint(voxelCenterPt)
      if (signedDist > VoxelConstants.VOXEL_EPSILON) {
        return targetRGBA; // Not inside the box
      }
      planeSignedDistances.push(signedDist);
    }

    /*
    // Generate a set of sample points inside the current voxel
    const voxelSamplePts = HALTON_5PTS_SEQ_2_3_5.map((haltonPt,i) => this._samplePts[i].copy(voxelBoundingBox.min).add(haltonPt));

    // Filter down the samples to ones that are inside the box
    const relevantPtSamples = [];
    for (const pt of voxelSamplePts) {
      
      for (const boxPlane of this._boxPlanes) {

        const signedDistToPlane = boxPlane.distanceToPoint(pt);
        if (signedDistToPlane > VoxelConstants.VOXEL_EPSILON) { continue; } // Not inside the box

        if (this.isFilled() || signedDistToPlane >= -SAMPLE_THRESHOLD) {
          const unsignedDistToPlane = Math.abs(signedDistToPlane);
          const normal = boxPlane.normal;
          const point  = new THREE.Vector3().copy(pt).addScaledVector(normal, unsignedDistToPlane + VoxelConstants.VOXEL_EPSILON); // Closest point to the sample point on the box
          relevantPtSamples.push({point, normal, uv:null, falloff:1});
        }
      }
    }
    if (relevantPtSamples.length > 0) {
      targetRGBA.a = 1;
      scene.calculateLightingSamples(targetRGBA, voxelIdxPt, relevantPtSamples, this._material, this.isShadowReceiver());
    }
    */

    // What are the closest planes to the voxel... these will determine the sample(s) that we render
    const planeDistances = planeSignedDistances.map(sd => Math.abs(sd));
    const samples = [];
    if (this.isFilled()) {
      for (let i = 0, l =  this._boxPlanes.length; i < l; i++) {
        const signedPlaneDistance = planeSignedDistances[i];
        if (signedPlaneDistance < SAMPLE_THRESHOLD) {
          const plane = this._boxPlanes[i];
          const planeNormal = plane.normal;
          const planeDistance = planeDistances[i];
          samples.push({
            point: new THREE.Vector3().copy(voxelCenterPt).addScaledVector(planeNormal, planeDistance + VoxelConstants.VOXEL_EPSILON),
            normal: planeNormal, uv: null, falloff: 1
          });
        }
      }
    }
    else {
      for (let i = 0, l = this._boxPlanes.length; i < l; i++) {
        const signedPlaneDistance = planeSignedDistances[i];
        if (signedPlaneDistance >= -SAMPLE_THRESHOLD) {
          const plane = this._boxPlanes[i];
          const planeDistance = planeDistances[i];
          const falloff = 1;//planeDistance < VoxelConstants.VOXEL_ERR_UNITS ? 1 : THREE.MathUtils.clamp(1-Math.pow(planeDistance/SAMPLE_THRESHOLD,2),0,1);
          samples.push({
            point: new THREE.Vector3().copy(voxelCenterPt).addScaledVector(plane.normal, planeDistance + VoxelConstants.VOXEL_EPSILON),
            normal: plane.normal, uv: null, falloff
          });
        }
      }
    }

    // Perform lighting for each of the samples with equal factoring per sample
    if (samples.length > 0) {
      targetRGBA.a = 1;
      scene.calculateLightingSamples(targetRGBA, voxelIdxPt, samples, this._material, this.isShadowReceiver(), 1);
    }

    return targetRGBA;
  }
}

export default VTRPBox;