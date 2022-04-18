import * as THREE from 'three';

import {VTBoxAbstract} from "../VTBox";
import VTMaterialFactory from '../VTMaterialFactory';

//import {SQRT2PI} from '../../MathUtils';
import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';

const nX = new THREE.Vector3(1,0,0);
const nY = new THREE.Vector3(0,1,0);
const nZ = new THREE.Vector3(0,0,1);

//const sigma = (2*VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS) / 10.0;
//const valueAtZero = (1.0 / (SQRT2PI*sigma));

class VTRPBox extends VTBoxAbstract {
  constructor(center, size, material, options) {
    super(center, size, material, options);

    this._center   = center;
    this._halfSize = size.multiplyScalar(0.5);

    this._tempVec3_0 = new THREE.Vector3();
    this._tempVec3_1 = new THREE.Vector3();
    this._tempVec3_2 = new THREE.Vector3();

    const {min, max} = this._box;

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

  static build(jsonData) {
    const {id, drawOrder, center, size, material, options} = jsonData;
    const result = new VTRPBox(
      new THREE.Vector3(center.x, center.y, center.z), 
      new THREE.Vector3(size.x, size.y, size.z), 
      VTMaterialFactory.build(material), options
    );
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
    const finalColour = new THREE.Color(0,0,0);
    const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(voxelIdxPt);
    const voxelCenterPt = voxelBoundingBox.getCenter(this._tempVec3_0);

    // Fast-out if we can't even see this box or the current voxel
    if (!this._material.isVisible() || this._boxPlanes.length === 0) { return finalColour; }

    // Another fast-out if the voxel isn't on or inside the box
    const planeSignedDistances = this._boxPlanes.map(boxPlane => boxPlane.distanceToPoint(voxelCenterPt));
    const insideDistances = planeSignedDistances.filter(d => d <= 0);
    if (insideDistances.length === 0) { return finalColour; }

    // What are the closest planes to the voxel... these will determine the sample(s) that we render
    const planeDistances = planeSignedDistances.map(d => Math.abs(d));
    const samples = [];
    let factorPerSample = 1;
    if (this.isFilled()) {
      // When the box is filled we need to determine what planes will effect the current voxel
      // based on whether that plane is within half the box's distance projected onto the normal of that plane
      for (let i = 0; i < this._boxPlanes.length; i++) {
        // Project the vector from the center of the box to the voxel's center onto the normal of the current plane
        const plane = this._boxPlanes[i];
        const planeNormal = plane.normal;
        const planeDistance = planeDistances[i];
        samples.push({
          point: new THREE.Vector3().copy(voxelCenterPt).addScaledVector(planeNormal, planeDistance + VoxelConstants.VOXEL_EPSILON),
          normal: planeNormal,
          uv: null, 
          falloff: 1//planeDistance <= VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS ? 1 :  ((1.0 / (SQRT2PI*sigma)) * Math.exp(-0.5 * (planeDistance*planeDistance / (2*sigma*sigma))) / valueAtZero),
        });
      }
    }
    else {
      for (let i = 0; i < this._boxPlanes.length; i++) {
        const planeDistance = planeDistances[i];
        if (planeDistance <= VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS) {
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
      finalColour.add(scene.calculateLightingSamples(voxelIdxPt, samples, this._material, this.isShadowReceiver(), factorPerSample));
    }

    return finalColour;
  }
}

export default VTRPBox;