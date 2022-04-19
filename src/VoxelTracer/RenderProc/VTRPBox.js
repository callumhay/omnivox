import * as THREE from 'three';

import VTMaterialFactory from '../VTMaterialFactory';

//import {SQRT2PI} from '../../MathUtils';
import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';
import VTRPObject from './VTRPObject';
import VTConstants from '../VTConstants';

const nX = new THREE.Vector3(1,0,0);
const nY = new THREE.Vector3(0,1,0);
const nZ = new THREE.Vector3(0,0,1);

class VTRPBox extends VTRPObject {
  constructor(min, max, material, options) {
    super(VTConstants.BOX_TYPE);

    this._box = new THREE.Box3(min, max); // TODO: Make this the non-transformed box, then have the center be a local translation
    this._material = material;
    this._options  = options;

    this._tempVec3_0 = new THREE.Vector3();
    this._tempVec3_1 = new THREE.Vector3();
    this._tempVec3_2 = new THREE.Vector3();

    // Build the wall planes that make up the sides of this box...
    this._boxPlanes = [];
    if (!this._box.isEmpty()) {
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, this._tempVec3_0.copy(min).add(nY), this._tempVec3_1.copy(min).add(nX)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, this._tempVec3_0.copy(max).sub(nX), this._tempVec3_1.copy(max).sub(nY)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, this._tempVec3_0.copy(min).add(nX), this._tempVec3_1.copy(min).add(nZ)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, this._tempVec3_0.copy(max).sub(nZ), this._tempVec3_1.copy(max).sub(nX)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(min, this._tempVec3_0.copy(min).add(nZ), this._tempVec3_1.copy(min).add(nY)));
      this._boxPlanes.push((new THREE.Plane()).setFromCoplanarPoints(max, this._tempVec3_0.copy(max).sub(nY), this._tempVec3_1.copy(max).sub(nZ)));
    }
  }

  dispose() { this._material.dispose(); }

  static build(jsonData) {
    const {id, drawOrder, min, max, material, options} = jsonData;
    const result = new VTRPBox(
      new THREE.Vector3(min.x, min.y, min.z), 
      new THREE.Vector3(max.x, max.y, max.z),
      VTMaterialFactory.build(material), options
    );
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }
  isFilled() { return this._options.fill || false; }

  intersectsRay(raycaster) { return raycaster.ray.intersectsBox(this._box); }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowReceiver() && this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    const finalColour = new THREE.Color(0,0,0);
    const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
    const voxelCenterPt = voxelBoundingBox.getCenter(this._tempVec3_0);

    // Fast-out if we can't even see this box or the current voxel
    // NOTE: this._box.containsPoint is super important... for some reason.
    if (!this._material.isVisible() || this._boxPlanes.length === 0 || !this._box.containsPoint(voxelCenterPt)) { return finalColour; }

    // What are the closest planes to the voxel... these will determine the sample(s) that we render
    const planeDistances = this._boxPlanes.map(boxPlane => Math.abs(boxPlane.distanceToPoint(voxelCenterPt)));
    const samples = [];
    if (this.isFilled()) {
      for (let i = 0, l =  this._boxPlanes.length; i < l; i++) {
        
        const plane = this._boxPlanes[i];
        const planeNormal = plane.normal;
        const planeDistance = planeDistances[i];
        samples.push({
          point: new THREE.Vector3().copy(voxelCenterPt).addScaledVector(planeNormal, planeDistance + VoxelConstants.VOXEL_EPSILON),
          normal: planeNormal, uv: null, falloff: 1
        });
      }
    }
    else {
      for (let i = 0, l = this._boxPlanes.length; i < l; i++) {
        const planeDistance = planeDistances[i];
        if (planeDistance < VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS) {
          const plane = this._boxPlanes[i];
          samples.push({
            point: new THREE.Vector3().copy(voxelCenterPt).addScaledVector(plane.normal, planeDistance + VoxelConstants.VOXEL_EPSILON),
            normal: plane.normal, uv: null, falloff: 1
          });
        }
      }
    }

    // Perform lighting for each of the samples with equal factoring per sample
    if (samples.length > 0) {
      finalColour.add(scene.calculateLightingSamples(voxelIdxPt, samples, this._material, this.isShadowReceiver(), 1));
    }

    return finalColour;
  }
}

export default VTRPBox;