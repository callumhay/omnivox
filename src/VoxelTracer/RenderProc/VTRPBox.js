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

const _tempVec3_0 = new THREE.Vector3();
const _tempVec3_1 = new THREE.Vector3();
const _tempRay = new THREE.Ray();

class VTRPBox extends VTRPObject {
  constructor(minPt, maxPt, matrixWorld, invMatrixWorld, material, options) {
    super(VTConstants.BOX_TYPE);

    this._matrixWorld = matrixWorld;
    this._invMatrixWorld = invMatrixWorld;

    this._box = new THREE.Box3(minPt, maxPt); // The non-transformed box

    this._material = material;
    this._options  = options;

    // Build the wall planes that make up the sides of this box in worldspace
    this._boxPlanes = [];
    if (!this._box.isEmpty()) {
      const {min, max} = this._box;
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, _tempVec3_0.copy(min).add(nY), _tempVec3_1.copy(min).add(nX)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, _tempVec3_0.copy(max).sub(nX), _tempVec3_1.copy(max).sub(nY)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, _tempVec3_0.copy(min).add(nX), _tempVec3_1.copy(min).add(nZ)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, _tempVec3_0.copy(max).sub(nZ), _tempVec3_1.copy(max).sub(nX)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, _tempVec3_0.copy(min).add(nZ), _tempVec3_1.copy(min).add(nY)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, _tempVec3_0.copy(max).sub(nY), _tempVec3_1.copy(max).sub(nZ)));
    }

    const normalMatrix = (new THREE.Matrix3()).getNormalMatrix(this._matrixWorld)
    for (const plane of this._boxPlanes) { plane.applyMatrix4(this._matrixWorld, normalMatrix); }

    if (!this.isFilled()) {
      this._interiorBoxPlanes = this._boxPlanes.map(plane => {
        _tempVec3_0.copy(plane.normal).negate();
        return plane.clone().translate(_tempVec3_0);
      });
    }
  }

  dispose() { this._material.dispose(); }

  static build(jsonData) {
    const {id, drawOrder, matrixWorld, invMatrixWorld, min, max, material, options} = jsonData;
    const result = new VTRPBox(
      new THREE.Vector3(min.x, min.y, min.z), 
      new THREE.Vector3(max.x, max.y, max.z),
      (new THREE.Matrix4()).fromArray(matrixWorld),
      (new THREE.Matrix4()).fromArray(invMatrixWorld),
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
    const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
    const voxelCenterPt = voxelBoundingBox.getCenter(_tempVec3_0);

    // Fast-out if we can't even see this box 
    if (!this._material.isVisible() || this._boxPlanes.length === 0) { return targetRGBA; }

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