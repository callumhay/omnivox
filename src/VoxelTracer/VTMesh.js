import * as THREE from 'three';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast} from 'three-mesh-bvh';

// Add the extension functions for calculating bounding volumes for THREE.Mesh/THREE.Geometry
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const closestPt = new THREE.Vector3(0,0,0);
const triNorm   = new THREE.Vector3(0,0,0);
const baryCoord = new THREE.Vector3(0,0,0);
const n0 = new THREE.Vector3(0,0,0);
const n1 = new THREE.Vector3(0,0,0);
const n2 = new THREE.Vector3(0,0,0);

class VTMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.threeMesh = new THREE.Mesh(this.geometry);

    this.geometry.computeBoundsTree();
  }

  calculateVoxelColour(voxelPt, scene) {
    const voxelBoundingBox = scene.voxelModel.getVoxelBoundingBox(voxelPt);

    // Start by finding all triangles in this mesh that may intersect with the given voxel
    const voxelTriangles = [];
    this.geometry.boundsTree.shapecast(
      this.threeMesh,
      box => voxelBoundingBox.intersectsBox(box),
      (tri, a, b, c) => {
        if (voxelBoundingBox.intersectsTriangle(tri)) {
          voxelTriangles.push({
            triangle: tri,
            indices: [a, b, c]
          });
        }
        return false; // We return false here to make sure we get the exhaustive list of all intersected triangles
      }
    );

    let finalColour = new THREE.Color(0,0,0);
    if (voxelTriangles.length > 0) {

      let avgNormal = new THREE.Vector3(0,0,0);
      let avgPoint  = new THREE.Vector3(0,0,0);

      voxelTriangles.forEach(triangleObj => {
        
        const {triangle, indices} = triangleObj;

        const indexAttr = this.geometry.index;
        const normalAttr = this.geometry.getAttribute('normal');
        
        // Is the center of the voxel inside the mesh (behind the triangle) or outside the mesh (in front of the triangle)
        // If inside then we consider the voxel to fully represent the mesh, otherwise we are either not counting it or antialiasing
        triangle.closestPointToPoint(voxelPt, closestPt);
        avgPoint.add(closestPt);

        //const triToVoxelCenterVec = voxelPt.clone().sub(closestPt);
        //const distToTriangle = triToVoxelCenterVec.length();
        //const nTriToVoxelCenterVec = triToVoxelCenterVec.divideScalar(Math.max(VOXEL_EPSILON, distToTriangle));

        triangle.getNormal(triNorm);
        triangle.getBarycoord(closestPt, baryCoord);

        // Calculate the normal at the closest point on the triangle via barycenteric coords
        const i0 = indexAttr.getX(indices[0]);
        const i1 = indexAttr.getX(indices[1]);
        const i2 = indexAttr.getX(indices[2]);

        n0.set(normalAttr.getX(i0), normalAttr.getY(i0), normalAttr.getZ(i0));
        n1.set(normalAttr.getX(i1), normalAttr.getY(i1), normalAttr.getZ(i1));
        n2.set(normalAttr.getX(i2), normalAttr.getY(i2), normalAttr.getZ(i2));

        n0.multiplyScalar(baryCoord.x);
        n1.multiplyScalar(baryCoord.y);
        n2.multiplyScalar(baryCoord.z);

        n0.add(n1.add(n2)); // Store the calculated normal in n0
        n0.normalize();

        avgNormal.add(n0);
        //avgNormal.add(triNorm);
      });
      
      avgNormal.divideScalar(voxelTriangles.length).normalize();
      avgPoint.divideScalar(voxelTriangles.length);

      const lightingColour = scene.calculateLighting(avgPoint, avgNormal, this.material);
      finalColour.add(lightingColour);
    }

    return finalColour;
  }

  intersectsBox(voxelBoundingBox) {
    return this.geometry.boundsTree.intersectsBox(this.threeMesh, voxelBoundingBox, new THREE.Matrix4());
  }
  intersectsRay(raycaster) {
    return this.geometry.boundsTree.raycastFirst(this.threeMesh, raycaster, raycaster.ray) !== null;
  }

  getCollidingVoxels(voxelModel) {
    const {boundingBox} = this.geometry;
    return voxelModel.voxelBoxList(boundingBox.min, boundingBox.max);
  }
}

export default VTMesh;