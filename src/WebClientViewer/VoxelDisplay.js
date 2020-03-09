import * as THREE from 'three';
import {VOXEL_ERR_UNITS} from '../MathUtils';

const voxelUnitSize = 1.0; // THIS MUST ALWAYS BE 1!!!
const halfVoxelUnitSize = voxelUnitSize / 2.0;
const ledUnitSize = voxelUnitSize / 4.0;

const DEFAULT_VOXEL_GRID_SIZE = 8;

class VoxelDisplay {
  constructor(scene) {
    this._scene = scene;
    this.rebuild(DEFAULT_VOXEL_GRID_SIZE)
  }

  rebuild(gridSize) {
    this.gridSize = gridSize;
    this.voxels = [];

    const ledGeometry = new THREE.BoxGeometry(ledUnitSize, ledUnitSize, ledUnitSize);
    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(voxelUnitSize, voxelUnitSize, voxelUnitSize));

    const outlineMaterial = new THREE.LineBasicMaterial({color: 0xffffff});
    outlineMaterial.transparent = true;
    outlineMaterial.opacity = 0.1;

    const halfTranslationUnits = (gridSize*voxelUnitSize)/2.0;
    const worldTranslation = new THREE.Vector3(-halfTranslationUnits, -halfTranslationUnits, -halfTranslationUnits);

    for (let x = 0; x < gridSize; x++) {
      let currXArr = [];
      this.voxels.push(currXArr);
      for (let y = 0; y < gridSize; y++) {
        let currYArr = [];
        currXArr.push(currYArr);
        for (let z = 0; z < gridSize; z++) {

          const ledMatrial = new THREE.MeshBasicMaterial({color: 0x000000});
          ledMatrial.transparent = true;
          ledMatrial.opacity = 0.85;

          const ledMesh = new THREE.Mesh(ledGeometry, ledMatrial);
          const outlineMesh = new THREE.LineSegments(outlineGeometry, outlineMaterial);
              
          const currZObj = {
            ledMesh: ledMesh,
            outlineMesh: outlineMesh,

            getColour: function() {
              return this.ledMesh.material.color;
            },
            setColourRGB: function(r, g, b) {
              this.ledMesh.material.color.setRGB(r, g, b);
            },
            setColour: function(colour) { 
              this.ledMesh.material.color.set(colour);
            },
            addColour: function(colour) { return this.ledMesh.material.color.add(colour); },
          };
            
          this._scene.add(ledMesh);
          this._scene.add(outlineMesh);
          
          const currTranslation = new THREE.Vector3(
            x*voxelUnitSize + halfVoxelUnitSize,
            y*voxelUnitSize + halfVoxelUnitSize,
            z*voxelUnitSize + halfVoxelUnitSize
          );
          currTranslation.add(worldTranslation);
          
          ledMesh.position.set(currTranslation.x, currTranslation.y, currTranslation.z);
          outlineMesh.position.set(currTranslation.x, currTranslation.y, currTranslation.z);
          
          currYArr.push(currZObj);
        }
      }
    }
  }

  xSize() { return this.voxels.length; }
  ySize() { return this.voxels[0].length; }
  zSize() { return this.voxels[0][0].length; }

  /**
   * Build a flat list of all of the possible voxel indices (x,y,z) in this display
   * as a list of THREE.Vector3 objects.
   */
  voxelIndexList() {
    const idxList = [];
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          idxList.push(new THREE.Vector3(x,y,z));
        }
      }
    }
    return idxList;
  }

  setVoxelXYZRGB(x,y,z,r,g,b) {
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    const roundedZ = Math.round(z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      this.voxels[roundedX][roundedY][roundedZ].setColourRGB(r, g, b);
    } 
  }

  setVoxel(pt, colour) {
    this.setVoxelXYZRGB(pt.x, pt.y, pt.z, colour.r, colour.g, colour.b);
  }

  addToVoxel(pt, colour) {
    const roundedX = Math.round(pt.x);
    const roundedY = Math.round(pt.y);
    const roundedZ = Math.round(pt.z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      const voxel = this.voxels[roundedX][roundedY][roundedZ];
      voxel.addColour(colour);
    } 
  }

  clearRGB(r=0, g=0, b=0) {
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          this.voxels[x][y][z].setColourRGB(r,g,b);
        }
      }
    }
  }
  clear(colour) {
    this.clearRGB(colour.r, colour.g, colour.b);
  }

  voxelBoxList(minPt=new THREE.Vector3(0,0,0), maxPt=new THREE.Vector3(1,1,1), fill=false) {
    const voxelPts = [];
    const floorMinPt = minPt.clone().floor();
    const ceilMaxPt  = maxPt.clone().ceil();

    if (fill) {
      for (let x = floorMinPt.x; x <= ceilMaxPt.x; x++) {
        for (let y = floorMinPt.y; y <= ceilMaxPt.y; y++) {
          for (let z = floorMinPt.z; z <= ceilMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }
    else {
      // Not filling the box... just go around the outside of it
      let incX = Math.floor(ceilMaxPt.x-floorMinPt.x);
      if (incX <= 0) {
        incX = ceilMaxPt.x-floorMinPt.x;
      }

      for (let x = floorMinPt.x; x <= ceilMaxPt.x; x += incX) {
        for (let y = floorMinPt.y; y <= ceilMaxPt.y; y++) {
          for (let z = floorMinPt.z; z <= ceilMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incY = Math.floor(ceilMaxPt.y-floorMinPt.y);
      if (incY <= 0) {
        incY = ceilMaxPt.y-floorMinPt.y;
      }

      for (let y = floorMinPt.y; y <= ceilMaxPt.y; y += incY) {
        for (let x = floorMinPt.x+1; x < ceilMaxPt.x; x++) {
          for (let z = floorMinPt.z; z <= ceilMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incZ = Math.floor(ceilMaxPt.z-floorMinPt.z);
      if (incZ <= 0) {
        incZ = ceilMaxPt.z-floorMinPt.z;
      }

      for (let z = floorMinPt.z; z <= ceilMaxPt.z; z += incZ) {
        for (let x = floorMinPt.x+1; x < ceilMaxPt.x; x++) {
          for (let y = floorMinPt.y+1; y < ceilMaxPt.y; y++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }

    return voxelPts;
  }

  voxelSphereList(center=new THREE.Vector3(0,0,0), radius=1, fill=false) {
    // Create a bounding box for the sphere: 
    // Centered at the given center with a half width/height/depth of the given radius
    const sphereBounds = new THREE.Sphere(center, radius);
    const sphereBoundingBox = new THREE.Box3(center.clone().subScalar(radius).floor(), center.clone().addScalar(radius).ceil());

    // Now we go through all the voxels in the bounding box and build a point list
    const voxelPts = [];
    for (let x = sphereBoundingBox.min.x; x <= sphereBoundingBox.max.x; x++) {
      for (let y = sphereBoundingBox.min.y; y <= sphereBoundingBox.max.y; y++) {
        for (let z = sphereBoundingBox.min.z; z <= sphereBoundingBox.max.z; z++) {
          // Check whether the current voxel is inside the radius of the sphere
          const currPt = new THREE.Vector3(x,y,z);
          const distToCurrPt = sphereBounds.distanceToPoint(currPt);
          if (fill) {
            if (distToCurrPt < VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
          else {
            if (Math.abs(distToCurrPt) < VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
        }
      }
    }

    return voxelPts;
  }
}

export default VoxelDisplay;