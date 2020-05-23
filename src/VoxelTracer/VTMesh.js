import * as THREE from 'three';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast, MeshBVH, SAH} from 'three-mesh-bvh';
import {VOXEL_EPSILON, SQRT2PI, SQRT3} from '../MathUtils';
import { Box3 } from 'three';

// Add the extension functions for calculating bounding volumes for THREE.Mesh/THREE.Geometry
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/*
// Simple box filter for 3D convolution window.
class VTBoxFilter3D {
  constructor(samplesPerAxis, options) {
    this.samplesPerAxis = samplesPerAxis;
  }

  getWeight(boxIdx) {
    return 1.0 / Math.pow(this.samplesPerAxis,3);
  }
}

// Gaussian 3D convolution window.
class VTGaussianFilter3D {
  constructor(samplesPerAxis, options) {
    this._samplesPerAxis = samplesPerAxis;
    this.sigma = options.sigma;
    this.recomputeWindow();
  }

  get samplesPerAxis() { 
    return this._samplesPerAxis;
  }
  set samplesPerAxis(s) {
    this._samplesPerAxis = s;
    this.recomputeWindow();
  }

  recomputeWindow() {
    this._window = new Float32Array(Math.pow(this.samplesPerAxis, 3));
    
    let idx = 0;
    let total = 0;
    for (let x = 0; x < this.samplesPerAxis; x++) {
      for (let y = 0; y < this.samplesPerAxis; y++) {
        for (let z = 0; z < this.samplesPerAxis; z++) {

          const gaussianVal = (1.0 / Math.pow(Math.sqrt(2*Math.PI)*this.sigma, 3)) * Math.exp(-0.5 * Math.pow(x-0.5 + y-0.5 + z-0.5,2) / (this.sigma*this.sigma));
          this._window[idx++] = gaussianVal;
          total += gaussianVal;
        }
      }
    }

    // Normalize so that all parts of the kernel add up to 1
    for (let i = 0; i < this._window.length; i++) {
      this._window[i] /= total;
    }
  }

  getWeight(boxIdx) {
    return this._window[boxIdx];
  }
}; 

class VTUniformVoxelSampler {
  constructor(filter) {
    this.filter = filter;
  }

  getSampleBoxes(voxelIdxPt) {
    const {samplesPerAxis} = this.filter;
    const sampleSize = 1.0 / samplesPerAxis;
    const sampleBoxes = [];

    for (let x = 0; x < samplesPerAxis; x++) {
      for (let y = 0; y < samplesPerAxis; y++) {
        for (let z = 0; z < samplesPerAxis; z++) {
          let minPt = new THREE.Vector3(x*sampleSize, y*sampleSize, z*sampleSize);
          minPt.add(voxelIdxPt);
          let maxPt = new THREE.Vector3(minPt.x + sampleSize, minPt.y + sampleSize, minPt.z + sampleSize);
          sampleBoxes.push(new THREE.Box3(minPt, maxPt));
        }
      }
    }

    return sampleBoxes;
  }

  getSamplePoints(voxelIdxPt) {
    const {samplesPerAxis} = this.filter;
    const sampleSize = 1.0 / samplesPerAxis;
    const halfSampleSize = sampleSize / 2.0;
    const samplePts = [];

    for (let x = 0; x < samplesPerAxis; x++) {
      for (let y = 0; y < samplesPerAxis; y++) {
        for (let z = 0; z < samplesPerAxis; z++) {
          const currPt = new THREE.Vector3(x*sampleSize + halfSampleSize, y*sampleSize + halfSampleSize, z*sampleSize + halfSampleSize);
          currPt.add(voxelIdxPt);
          samplePts.push(currPt);
        }
      }
    }

    return samplePts;
  }

  getSampleWeight(boxIdx) {
    return this.filter.getWeight(boxIdx);
  }
}

const meshSampler = new VTUniformVoxelSampler(new VTGaussianFilter3D(3, {sigma: 1}));
*/

class VTMesh {
  // NOTE: All geometry MUST be buffer geometry!
  constructor(geometry, material) {
    this.geometry = geometry;
    this.geometry.computeBoundingBox();
    this.geometry.boundsTree = new MeshBVH(this.geometry, {strategy: SAH});
    this.material = material;
    this._threeMesh = new THREE.Mesh(this.geometry);

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
  }

  get position() { return this._threeMesh.position; }
  updateMatrixWorld() { this._threeMesh.updateMatrixWorld(); }

  calculateVoxelColour(voxelIdxPt, scene) {
    const voxelBoundingBox = scene.voxelModel.getVoxelBoundingBox(voxelIdxPt);
    voxelBoundingBox.getCenter(this._voxelCenterPt);

    const furthestPossibleDistFromCenter = SQRT3*Math.SQRT1_2;

    // Start by finding all triangles in this mesh that may intersect with the given voxel
    const voxelTriangles = [];
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
          voxelTriangles.push({
            triangle: worldSpaceTri,
            indices: [a, b, c],
            sqrDist: sqrDist,
            closestPt: this._closestPt.clone(),
          });
        }

        return false; // We return false here to make sure we get the exhaustive list of all intersected triangles
      }
    );

    let finalColour = new THREE.Color(0,0,0);
    if (voxelTriangles.length > 0) {

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

      let samples = [];
      const sigma = furthestPossibleDistFromCenter/3;
      const valueAtZero = (1.0 / SQRT2PI*sigma);

      for (let i = 0; i < voxelTriangles.length; i++) {
        const {triangle, closestPt, sqrDist, indices} = voxelTriangles[i];

        const sample = {
          point: closestPt,
          normal: new THREE.Vector3(),
          uv: new THREE.Vector2(),
          falloff: 1,
        };

        triangle.getBarycoord(closestPt, this._baryCoord);
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
  
        samples.push(sample);
      }

      finalColour.add(scene.calculateLightingSamples(samples, this.material));
    }
  
    return finalColour;
  }

  intersectsBox(voxelBoundingBox) {
    return this.geometry.boundsTree.intersectsBox(this._threeMesh, voxelBoundingBox, new THREE.Matrix4());
  }

  intersectsRay(raycaster) {
    raycaster.firstHitOnly = true;
    return raycaster.intersectObjects([this._threeMesh]).length > 0;
  }

  getCollidingVoxels(voxelModel) {

    const worldSpaceBB = this.geometry.boundingBox.clone().applyMatrix4(this._threeMesh.matrixWorld);
    return voxelModel.voxelBoxList(worldSpaceBB.min, worldSpaceBB.max, true);
  }
}

export default VTMesh;