import * as THREE from 'three';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast, MeshBVH, SAH} from 'three-mesh-bvh';

import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';
import {SQRT2PI} from '../../MathUtils';

import VTMaterialFactory from '../VTMaterialFactory';
import VTConstants from '../VTConstants';

import VTRPObject from './VTRPObject';
import VTPool from '../VTPool';
import VTRPObjectFactory from './VTRPObjectFactory';

const sigma = VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS / 10.0;
const valueAtZero = (1.0 / SQRT2PI*sigma);

// Temporary variables for use when calculating cached/memoized samples
const _tempBox = new THREE.Box3();
const _closestPt = new THREE.Vector3();
const _voxelCenterPt = new THREE.Vector3();
const _baryCoord = new THREE.Vector3();
const _n0 = new THREE.Vector3();
const _n1 = new THREE.Vector3();
const _n2 = new THREE.Vector3();
const _uv0 = new THREE.Vector2();
const _uv1 = new THREE.Vector2();
const _uv2 = new THREE.Vector2();
const _tempVec3 = new THREE.Vector3();

const _loader = new THREE.ObjectLoader();

//const _samplePool = new VTPool();

// Add the extension functions for calculating bounding volumes for THREE.Mesh/THREE.Geometry
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

class VTRPTriSample {
  constructor() {
    this.triangle = new THREE.Triangle();
    this.worldSpaceClosestPt = new THREE.Vector3();
    this.sample = {
      point: this.worldSpaceClosestPt,
      normal: new THREE.Vector3(),
      uv: new THREE.Vector2(),
      falloff: 1,
    };
  }

  set(wsTri, indices, sqrDist, wsClosestPt) {
    this.triangle.copy(wsTri);
    this.indices = indices;
    this.sqrDist = sqrDist;
    this.worldSpaceClosestPt.copy(wsClosestPt);
  }
}


class VTRPMesh extends VTRPObject {
  // NOTE: All geometry MUST be buffer geometry!
  constructor() {
    super(VTConstants.MESH_TYPE);
    this._material  = null;
    this._geometry  = null;
    this._threeMesh = null;
  }

  reinit() {
    this._voxelIdxToTriSamples = {}; // Memoization for voxel collisions and sampling
  }

  expire(pool) {
    if (this._material) {
      pool.expire(this._material);
      this._material = null;
    }
  }

  fromJSON(json, pool) {
    const {id, drawOrder, geometry, matrixWorld, material} = json;
    this.id = id;
    this.drawOrder = drawOrder;
    this._material = VTRPObjectFactory.updateOrBuildFromPool(material, pool, this._material);

    // Reload the geometry if it doesn't exist or is different
    if (!this._geometry || this._geometry.uuid !== geometry['uuid']) {
      const loadedGeometryMap = _loader.parseGeometries([geometry]);
      const loadedGeometry = Object.values(loadedGeometryMap)[0];
      loadedGeometry.computeBoundingBox();
      loadedGeometry.boundsTree = new MeshBVH(loadedGeometry, {strategy: SAH});
      this._geometry = loadedGeometry;
      this._threeMesh = new THREE.Mesh(loadedGeometry);
    }
    this._threeMesh.matrixWorld.fromArray(matrixWorld);

    this.reinit();

    return this;
  }

  isShadowCaster() { return true; }
  isShadowReceiver() { return true; }

  calculateShadow(raycaster) {
    return {
      inShadow: this.isShadowCaster() && this.intersectsRay(raycaster),
      lightReduction: this._material.alpha, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  _preRender(voxelIdxPt, voxelId) {
    let triSamples = null;

    // Have we memoized the current voxel index point yet?
    if (voxelId in this._voxelIdxToTriSamples) {
      // Just use the memoized values...
      triSamples = this._voxelIdxToTriSamples[voxelId];
    }
    else if (this._threeMesh.geometry.boundsTree) {
      // We need to build a set of new triangle samples for the given voxel
      const voxelBoundingBox = VoxelGeometryUtils.singleVoxelBoundingBox(_tempBox, voxelIdxPt);
      voxelBoundingBox.getCenter(_voxelCenterPt);

      // Start by finding all triangles in this mesh that may intersect with the given voxel
      triSamples = [];
      this._geometry.boundsTree.shapecast(
        this._threeMesh,
        box => {
          const worldSpaceBox = box.clone();
          worldSpaceBox.applyMatrix4(this._threeMesh.matrixWorld);
          return voxelBoundingBox.intersectsBox(worldSpaceBox);
        },
        (tri, a, b, c) => {
          const {matrixWorld} = this._threeMesh;
          const worldSpaceTri = tri;
          worldSpaceTri.a.applyMatrix4(matrixWorld);
          worldSpaceTri.b.applyMatrix4(matrixWorld);
          worldSpaceTri.c.applyMatrix4(matrixWorld);
  
          worldSpaceTri.closestPointToPoint(_voxelCenterPt, _closestPt);
  
          // Is the closest point even inside the voxel?
          if (voxelBoundingBox.containsPoint(_closestPt)) {
            _tempVec3.copy(_closestPt);
            const sqrDist = _tempVec3.sub(_voxelCenterPt).lengthSq();
            const newSample = new VTRPTriSample();
            newSample.set(worldSpaceTri, [a, b, c], sqrDist, _closestPt);
            triSamples.push(newSample);
          }
  
          return false; // We return false here to make sure we get the exhaustive list of all intersected triangles
        }
      );
      
      if (triSamples.length > 0) {
        const indexAttr  = this._geometry.index;
        const normalAttr = this._geometry.getAttribute('normal');
        const uvAttr     = this._geometry.getAttribute('uv');
  
        const calculateNormalBarycentric = (target, i0, i1, i2, baryCoord) => {
          _n0.set(normalAttr.getX(i0), normalAttr.getY(i0), normalAttr.getZ(i0));
          _n1.set(normalAttr.getX(i1), normalAttr.getY(i1), normalAttr.getZ(i1));
          _n2.set(normalAttr.getX(i2), normalAttr.getY(i2), normalAttr.getZ(i2));
          _n0.multiplyScalar(baryCoord.x);
          _n1.multiplyScalar(baryCoord.y);
          _n2.multiplyScalar(baryCoord.z);
          _n0.add(_n1.add(_n2));
          _n0.normalize();
          _n0.transformDirection(this._threeMesh.matrixWorld);
  
          target.copy(_n0);
        };
        const calculateUVBarycentric = (target, i0, i1, i2, baryCoord) => {
          _uv0.set(uvAttr.getX(i0), uvAttr.getY(i0));
          _uv1.set(uvAttr.getX(i1), uvAttr.getY(i1));
          _uv2.set(uvAttr.getX(i2), uvAttr.getY(i2));
          _uv0.multiplyScalar(baryCoord.x);
          _uv1.multiplyScalar(baryCoord.y);
          _uv2.multiplyScalar(baryCoord.z);
          _uv0.add(_uv1.add(_uv2));
  
          target.copy(_uv0);
        };
  
        for (let i = 0; i < triSamples.length; i++) {
          const vtTri = triSamples[i];
          
          const triangle = vtTri.triangle;
          const worldSpaceClosestPt = vtTri.worldSpaceClosestPt;
          const sqrDist = vtTri.sqrDist;
          const indices = vtTri.indices;
          const sample = vtTri.sample;
  
          triangle.getBarycoord(worldSpaceClosestPt, _baryCoord);
          const i0 = indexAttr.getX(indices[0]);
          const i1 = indexAttr.getX(indices[1]);
          const i2 = indexAttr.getX(indices[2]);
  
          calculateNormalBarycentric(sample.normal, i0, i1, i2, _baryCoord);
          calculateUVBarycentric(sample.uv, i0, i1, i2, _baryCoord);
  
          // Is the voxel sample point (i.e., the center) inside or outside the triangle?
          _tempVec3.copy(sample.point);
          _tempVec3.sub(_voxelCenterPt).normalize();
          const toTriangleDotNorm = _tempVec3.dot(sample.normal);
  
          // If the dot product was positive then the voxel sample point is "inside" the mesh, 
          // otherwise it's outside - in this case we use a gaussian falloff to dim the voxel.
          sample.falloff = (toTriangleDotNorm >= VoxelConstants.VOXEL_EPSILON) ? 1.0 : 
            ((1.0 / SQRT2PI*sigma) * Math.exp(-0.5 * (sqrDist / (2*sigma*sigma))) / valueAtZero);
        }
      }

      this._voxelIdxToTriSamples[voxelId] = triSamples;
    }

    return triSamples;
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    // Fast-out if we can't even see this mesh
    if (!this._material.isVisible()) { return targetRGBA; }
    
    // Grab a list of all the samples
    const voxelId = VoxelGeometryUtils.voxelFlatIdx(voxelIdxPt, scene.gridSize);
    const triSamples = this._preRender(voxelIdxPt, voxelId);
    if (triSamples.length > 0) {
      const samples = triSamples.map(triSample => triSample.sample);
      scene.calculateLightingSamples(targetRGBA, voxelIdxPt, samples, this._material);
    }
    
    return targetRGBA;
  }

  intersectsRay(raycaster) {
    raycaster.firstHitOnly = true;
    return raycaster.intersectObjects([this._threeMesh]).length > 0;
  }
}

export default VTRPMesh;
