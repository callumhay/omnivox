import * as THREE from 'three';
import VoxelConstants from './VoxelConstants';

class VoxelGeometryUtils {

  static voxelBoundingBox(gridSize) {
    const gridSizeMinus1 = gridSize-1;
    return new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(gridSizeMinus1,gridSizeMinus1,gridSizeMinus1));
  }

  static singleVoxelBoundingBox(voxelPt) {
    const adjustedX = Math.floor(voxelPt.x);
    const adjustedY = Math.floor(voxelPt.y);
    const adjustedZ = Math.floor(voxelPt.z);

    return new THREE.Box3(
      new THREE.Vector3(adjustedX, adjustedY, adjustedZ), 
      new THREE.Vector3(adjustedX + VoxelConstants.VOXEL_UNIT_SIZE, adjustedY + VoxelConstants.VOXEL_UNIT_SIZE, adjustedZ + VoxelConstants.VOXEL_UNIT_SIZE)
    );
  }

  static voxelFlatIdx(voxelPt, gridSize) {
    return voxelPt.x*gridSize*gridSize + voxelPt.y*gridSize + voxelPt.z;
  }
  static closestVoxelIdxPt(pt) {
    return new THREE.Vector3(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z));
  }
  static voxelIdStr(voxelPt) {
    return voxelPt.x.toFixed(0) + "_" + voxelPt.y.toFixed(0) + "_" + voxelPt.z.toFixed(0);
  }

  static voxelSphereList(center, radius, fill, voxelBoundingBox) {
    // Create a bounding box for the sphere: 
    // Centered at the given center with a half width/height/depth of the given radius
    const sphereBounds = new THREE.Sphere(center, radius);
    const sphereBoundingBox = new THREE.Box3(center.clone().subScalar(radius).floor().max(voxelBoundingBox.min), center.clone().addScalar(radius).ceil().min(voxelBoundingBox.max));

    // Now we go through all the voxels in the bounding box and build a point list
    const voxelPts = [];
    for (let x = sphereBoundingBox.min.x; x <= sphereBoundingBox.max.x; x++) {
      for (let y = sphereBoundingBox.min.y; y <= sphereBoundingBox.max.y; y++) {
        for (let z = sphereBoundingBox.min.z; z <= sphereBoundingBox.max.z; z++) {

          // Check whether the current voxel is inside the voxel grid and inside the radius of the sphere
          const currPt = new THREE.Vector3(x,y,z);
          const distToCurrPt = sphereBounds.distanceToPoint(currPt);
          if (fill) {
            if (distToCurrPt < VoxelConstants.VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
          else {
            if (Math.abs(distToCurrPt) < VoxelConstants.VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }

        }

      }
    }
    return voxelPts;
  }

  static voxelAABBList(minPt, maxPt, fill, voxelBoundingBox) {
    const voxelPts = [];
    const mappedMinPt = minPt.clone().floor();
    mappedMinPt.max(voxelBoundingBox.min);
    const mappedMaxPt = maxPt.clone().ceil();
    mappedMaxPt.min(voxelBoundingBox.max);

    if (fill) {
      for (let x = mappedMinPt.x; x <= mappedMaxPt.x; x++) {
        for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }
    else {
      // Not filling the box... just go around the outside of it
      let incX = Math.floor(mappedMaxPt.x-mappedMinPt.x);
      if (incX <= 0) {
        incX = mappedMaxPt.x-mappedMinPt.x;
      }

      for (let x = mappedMinPt.x; x <= mappedMaxPt.x; x += incX) {
        for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incY = Math.floor(mappedMaxPt.y-mappedMinPt.y);
      if (incY <= 0) {
        incY = mappedMaxPt.y-mappedMinPt.y;
      }

      for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y += incY) {
        for (let x = mappedMinPt.x+1; x < mappedMaxPt.x; x++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incZ = Math.floor(mappedMaxPt.z-mappedMinPt.z);
      if (incZ <= 0) {
        incZ = mappedMaxPt.z-mappedMinPt.z;
      }

      for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z += incZ) {
        for (let x = mappedMinPt.x+1; x < mappedMaxPt.x; x++) {
          for (let y = mappedMinPt.y+1; y < mappedMaxPt.y; y++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }
    return voxelPts;
  }
}

export default VoxelGeometryUtils;
