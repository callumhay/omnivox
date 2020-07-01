import * as THREE from 'three';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast, MeshBVH, SAH} from 'three-mesh-bvh';
import {SQRT2PI, SQRT3} from '../MathUtils';
import VoxelModel from '../Server/VoxelModel';

// Add the extension functions for calculating bounding volumes for THREE.Mesh/THREE.Geometry
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;


class VTTriSample {
  constructor(wsTri, indices, sqrDist, wsClosestPt) {
    this.triangle = wsTri;
    this.indices = indices;
    this.sqrDist = sqrDist;
    this.worldSpaceClosestPt = wsClosestPt;
    this.sample = {
      point: wsClosestPt,
      normal: new THREE.Vector3(),
      uv: new THREE.Vector2(),
      falloff: 1,
    };
  }
}

class VTMesh {
  // NOTE: All geometry MUST be buffer geometry!
  constructor(geometry, material) {
    this.geometry = geometry;
    this.geometry.computeBoundingBox();
    this.geometry.boundsTree = new MeshBVH(this.geometry, {strategy: SAH});
    this.material = material;
    this._threeMesh = new THREE.Mesh(this.geometry);

    // Memoization for voxel collisions and sampling
    this.voxelIdxToTriSamples = {}; 

    // Temporary variables
    this._closestPt     = new THREE.Vector3(0,0,0);
    this._voxelCenterPt = new THREE.Vector3(0,0,0);
    this._baryCoord     = new THREE.Vector3(0,0,0);
    this._n0  = new THREE.Vector3(0,0,0);
    this._n1  = new THREE.Vector3(0,0,0);
    this._n2  = new THREE.Vector3(0,0,0);
    this._uv0 = new THREE.Vector2(0,0);
    this._uv1 = new THREE.Vector2(0,0);
    this._uv2 = new THREE.Vector2(0,0);
    this._tempVec3 = new THREE.Vector3();
  }

  dispose() {
    this.geometry.disposeBoundsTree();
    this.geometry.dispose();
    this.material.dispose();
    this.dirty();
  }

  dirty() {
    this.voxelIdxToTriSamples = {}; 
  }

  // Transform methods
  setPosition(x,y,z) { 
    this._threeMesh.position.set(x,y,z);
    this.dirty();
  }
  updateMatrixWorld() { this._threeMesh.updateMatrixWorld(); }

  calculateShadow(raycaster) {
    return {
      inShadow: this.intersectsRay(raycaster),
      lightReduction: 1.0, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  preRender(voxelIdxPt) {
    let vtTriSamples = null;
    const voxelIdxLookup = VoxelModel.voxelIdStr(voxelIdxPt);

    // Have we memoized the current voxel index point yet?
    if (voxelIdxLookup in this.voxelIdxToTriSamples) {
      // Just use the memoized values...
      vtTriSamples = this.voxelIdxToTriSamples[voxelIdxLookup];
    }
    else {
      // We need to build a set of new triangle samples for the given voxel
      const voxelBoundingBox = VoxelModel.calcVoxelBoundingBox(voxelIdxPt);
      voxelBoundingBox.getCenter(this._voxelCenterPt);
  
      const furthestPossibleDistFromCenter = SQRT3*Math.SQRT1_2;
  
      // Start by finding all triangles in this mesh that may intersect with the given voxel
      vtTriSamples = [];
      this._threeMesh.geometry.boundsTree.shapecast(
        this._threeMesh,
        box => {
          const worldSpaceBox = box.clone();
          worldSpaceBox.applyMatrix4(this._threeMesh.matrixWorld);
          return voxelBoundingBox.intersectsBox(worldSpaceBox);
        },
        (tri, a, b, c) => {
          const {matrixWorld} = this._threeMesh;
          const worldSpaceTri = tri.clone();
          worldSpaceTri.a.applyMatrix4(matrixWorld);
          worldSpaceTri.b.applyMatrix4(matrixWorld);
          worldSpaceTri.c.applyMatrix4(matrixWorld);
  
          worldSpaceTri.closestPointToPoint(this._voxelCenterPt, this._closestPt);
  
          // Is the closest point even inside the voxel?
          if (voxelBoundingBox.containsPoint(this._closestPt)) {
            this._tempVec3.copy(this._closestPt);
            const sqrDist = this._tempVec3.sub(this._voxelCenterPt).lengthSq();
  
            vtTriSamples.push(new VTTriSample(worldSpaceTri, [a, b, c], sqrDist, this._closestPt.clone()));
          }
  
          return false; // We return false here to make sure we get the exhaustive list of all intersected triangles
        }
      );
      
      if (vtTriSamples.length > 0) {
        const indexAttr  = this.geometry.index;
        const normalAttr = this.geometry.getAttribute('normal');
        const uvAttr     = this.geometry.getAttribute('uv');
  
        const calculateNormalBarycentric = (target, i0, i1, i2, baryCoord) => {
          this._n0.set(normalAttr.getX(i0), normalAttr.getY(i0), normalAttr.getZ(i0));
          this._n1.set(normalAttr.getX(i1), normalAttr.getY(i1), normalAttr.getZ(i1));
          this._n2.set(normalAttr.getX(i2), normalAttr.getY(i2), normalAttr.getZ(i2));
          this._n0.multiplyScalar(baryCoord.x);
          this._n1.multiplyScalar(baryCoord.y);
          this._n2.multiplyScalar(baryCoord.z);
          this._n0.add(this._n1.add(this._n2));
          this._n0.normalize();
          this._n0.transformDirection(this._threeMesh.matrixWorld);
  
          target.copy(this._n0);
        };
        const calculateUVBarycentric = (target, i0, i1, i2, baryCoord) => {
          this._uv0.set(uvAttr.getX(i0), uvAttr.getY(i0));
          this._uv1.set(uvAttr.getX(i1), uvAttr.getY(i1));
          this._uv2.set(uvAttr.getX(i2), uvAttr.getY(i2));
          this._uv0.multiplyScalar(baryCoord.x);
          this._uv1.multiplyScalar(baryCoord.y);
          this._uv2.multiplyScalar(baryCoord.z);
          this._uv0.add(this._uv1.add(this._uv2));
  
          target.copy(this._uv0);
        };
  
        const sigma = furthestPossibleDistFromCenter / 10.0;
        const valueAtZero = (1.0 / SQRT2PI*sigma);
  
        for (let i = 0; i < vtTriSamples.length; i++) {
          const vtTri = vtTriSamples[i];
          
          const triangle = vtTri.triangle;
          const worldSpaceClosestPt = vtTri.worldSpaceClosestPt;
          const sqrDist = vtTri.sqrDist;
          const indices = vtTri.indices;
          const sample = vtTri.sample;
  
          triangle.getBarycoord(worldSpaceClosestPt, this._baryCoord);
          const i0 = indexAttr.getX(indices[0]);
          const i1 = indexAttr.getX(indices[1]);
          const i2 = indexAttr.getX(indices[2]);
  
          calculateNormalBarycentric(sample.normal, i0, i1, i2, this._baryCoord);
          calculateUVBarycentric(sample.uv, i0, i1, i2, this._baryCoord);
  
          // Is the voxel sample point (i.e., the center) inside or outside the triangle?
          this._tempVec3.copy(sample.point);
          this._tempVec3.sub(this._voxelCenterPt).normalize();
          const toTriangleDotNorm = this._tempVec3.dot(sample.normal);
  
          // If the dot product was positive then the voxel sample point is "inside" the mesh, 
          // otherwise it's outside - in this case we use a gaussian falloff to dim the voxel.
          sample.falloff = (toTriangleDotNorm >= 0.0) ? 1.0 : ((1.0 / SQRT2PI*sigma) * Math.exp(-0.5 * (sqrDist / (2*sigma*sigma))) / valueAtZero);
        }
      }

      this.voxelIdxToTriSamples[voxelIdxLookup] = vtTriSamples;
    }

    return vtTriSamples;
  }

  calculateVoxelColour(voxelIdxPt, scene) {
    let finalColour = new THREE.Color(0,0,0);

    // Fast-out if we can't even see this mesh
    if (!this.material.isVisible()) {
      return finalColour;
    }
    
    // Grab a list of all the samples
    const vtTriSamples = this.preRender(voxelIdxPt);
    const samples = vtTriSamples.map(triSample => triSample.sample);
    finalColour.add(scene.calculateLightingSamples(samples, this.material));
  
    return finalColour;
  }

  intersectsBox(box) {
    return this.geometry.boundsTree.intersectsBox(this._threeMesh, box, new THREE.Matrix4());
  }

  intersectsRay(raycaster) {
    //return this.geometry.boundsTree.raycastFirst(this._threeMesh, raycaster, raycaster.ray) !== null;
    raycaster.firstHitOnly = true;
    return raycaster.intersectObjects([this._threeMesh]).length > 0;
  }

  getCollidingVoxels() {
    const worldSpaceBB = this.geometry.boundingBox.clone().applyMatrix4(this._threeMesh.matrixWorld);
    return VoxelModel.voxelBoxList(worldSpaceBB.min, worldSpaceBB.max, true);
  }
}

export default VTMesh;
