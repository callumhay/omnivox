import * as THREE from 'three';

import VTMaterialFactory from '../VTMaterialFactory';

import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';

import VTConstants from '../VTConstants';
import {defaultBoxOptions} from '../VTBox';

import VTRPObject from './VTRPObject';

//import {HALTON_5PTS_SEQ_2_3_5} from '../../Samplers';

const nX = new THREE.Vector3(1,0,0);
const nY = new THREE.Vector3(0,1,0);
const nZ = new THREE.Vector3(0,0,1);

const _tempVec3_0 = new THREE.Vector3();
const _tempVec3_1 = new THREE.Vector3();
const _tempRay = new THREE.Ray();
const _tempNormMatrix = new THREE.Matrix3();

class VTRPBox extends VTRPObject {
  constructor() {
    super(VTConstants.BOX_TYPE);

    this._matrixWorld = new THREE.Matrix4();
    this._invMatrixWorld = new THREE.Matrix4();
    this._box = new THREE.Box3();
    this._material = null;
    this._options  = {...defaultBoxOptions};

    // Build the wall planes that make up the sides of this box in worldspace
    const NUM_PLANES = 6;
    this._boxPlanes = new Array(NUM_PLANES).fill(null);
    this._interiorBoxPlanes = new Array(NUM_PLANES).fill(null);
    for (let i = 0; i < NUM_PLANES; i++) {
      this._boxPlanes[i] = new THREE.Plane();
      this._interiorBoxPlanes[i] = new THREE.Plane();
    }
  }

  reinitPlanes() {
    const {min, max} = this._box;
    this._boxPlanes[0].setFromCoplanarPoints(min, _tempVec3_0.copy(min).add(nY), _tempVec3_1.copy(min).add(nX));
    this._boxPlanes[1].setFromCoplanarPoints(max, _tempVec3_0.copy(max).sub(nX), _tempVec3_1.copy(max).sub(nY));
    this._boxPlanes[2].setFromCoplanarPoints(min, _tempVec3_0.copy(min).add(nX), _tempVec3_1.copy(min).add(nZ));
    this._boxPlanes[3].setFromCoplanarPoints(max, _tempVec3_0.copy(max).sub(nZ), _tempVec3_1.copy(max).sub(nX));
    this._boxPlanes[4].setFromCoplanarPoints(min, _tempVec3_0.copy(min).add(nZ), _tempVec3_1.copy(min).add(nY));
    this._boxPlanes[5].setFromCoplanarPoints(max, _tempVec3_0.copy(max).sub(nY), _tempVec3_1.copy(max).sub(nZ));

    _tempNormMatrix.getNormalMatrix(this._matrixWorld)
    for (const plane of this._boxPlanes) { plane.applyMatrix4(this._matrixWorld, _tempNormMatrix); }

    if (!this.isFilled()) {
      for (let i = 0, numPlanes = this._boxPlanes.length; i < numPlanes; i++) {
        const outerBoxPlane = this._boxPlanes[i];
        const innerBoxPlane = this._interiorBoxPlanes[i];
        innerBoxPlane.copy(outerBoxPlane);
        _tempVec3_0.copy(outerBoxPlane.normal).negate();
        innerBoxPlane.translate(_tempVec3_0);
      }
    }
  }

  expire(pool) {
    if (this._material) {
      pool.expire(this._material);
      this._material = null;
    }
  }

  fromJSON(json, pool) {
    const {id, drawOrder, matrixWorld, invMatrixWorld, min, max, material, options} = json;
    this.id = id;
    this.drawOrder = drawOrder;
    this._matrixWorld.fromArray(matrixWorld);
    this._invMatrixWorld.fromArray(invMatrixWorld);
    this._box.set(min, max);
    this._options = {...this._options, ...options};

    if (this._material && this._material.type !== material.type) {
      pool.expire(this._material);
      this._material = VTMaterialFactory.buildFromPool(material, pool);
    }
    else {
      this._material.fromJSON(material, pool);
    }

    this.reinitPlanes();
    return this;
  }

  static build(jsonData) {
    const {id, drawOrder, matrixWorld, invMatrixWorld, min, max, material, options} = jsonData;

    const result = new VTRPBox();
    result.id = id;
    result.drawOrder = drawOrder;
    result._matrixWorld.fromArray(matrixWorld);
    result._invMatrixWorld.fromArray(invMatrixWorld);
    result._box.set(min, max);
    result._options = {...result._options, ...options};
    result._material = VTMaterialFactory.build(material);
    result.reinitPlanes();

    return result;
  }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }
  isFilled() { return this._options.fill || false; }

  intersectsRay(raycaster) { 
    // Move the ray into local space and check if it collides with the local space box
    _tempRay.copy(raycaster.ray);
    _tempRay.applyMatrix4(this._invMatrixWorld);
    return _tempRay.intersectsBox(this._box);
  }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster() && this.intersectsRay(raycaster),
      lightReduction: this._material.alpha, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    const voxelCenterPt = VoxelGeometryUtils.voxelCenterPt(_tempVec3_0, voxelIdxPt);

    // Fast-out if we can't even see this box 
    if (!this._material.isVisible() || this._box.isEmpty()) { return targetRGBA; }

    // ... also check whether the voxel point isn't inside this box
    const planeSignedDistances = [];
    for (const plane of this._boxPlanes) {
      const signedDist = plane.distanceToPoint(voxelCenterPt);
      if (signedDist > VoxelConstants.VOXEL_EPSILON) {
        return targetRGBA; // Not inside the box
      }
      planeSignedDistances.push(signedDist);
    }


    // What are the closest planes to the voxel... these will determine the sample(s) that we render
    let planeDistances = null;
    let relevantPlanes = this._boxPlanes;
    const samples = [];

    // Make sure the voxel is inside the outline of the box if the box isn't filled in
    if (!this.isFilled() && this._interiorBoxPlanes) {
      relevantPlanes = [];
      planeDistances = [];
      for (let i = 0, numInteriorPlanes = this._interiorBoxPlanes.length; i < numInteriorPlanes; i++) {
        const interiorPlane = this._interiorBoxPlanes[i];
        const signedDist = interiorPlane.distanceToPoint(voxelCenterPt);
        if (signedDist > 0) {
          relevantPlanes.push(this._boxPlanes[i]);
          planeDistances.push(Math.abs(signedDist));
        }
      }
      if (relevantPlanes.length === 0) { return targetRGBA; }
    }
    else {
      planeDistances = planeSignedDistances.map(sd => Math.abs(sd));
    }

    for (let i = 0, numPlanes = relevantPlanes.length; i < numPlanes; i++) {
      const plane = relevantPlanes[i];
      const planeNormal = plane.normal;
      const planeDistance = planeDistances[i];
      samples.push({
        point: new THREE.Vector3().copy(voxelCenterPt).addScaledVector(planeNormal, planeDistance + VoxelConstants.VOXEL_EPSILON),
        normal: planeNormal, uv: null, falloff: 1
      });
    }
  
    // Perform lighting for each of the samples with equal factoring per sample
    if (samples.length > 0) {
      scene.calculateLightingSamples(targetRGBA, voxelIdxPt, samples, this._material, this.isShadowReceiver(), 1);
    }

    return targetRGBA;
  }
}

export default VTRPBox;