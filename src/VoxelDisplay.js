import * as THREE from 'three';

const voxelUnitSize = 1.0;
const halfVoxelUnitSize = voxelUnitSize / 2.0;
const ledUnitSize = voxelUnitSize / 4.0;

const voxelGridSize = 8;
const xSize = voxelGridSize;
const ySize = voxelGridSize;
const zSize = voxelGridSize;

export const BLEND_MODE_OVERWRITE = 0;
export const BLEND_MODE_ADDITIVE  = 1;

class VoxelDisplay {
  constructor(scene) {

    this.voxels = [];
    this.blendMode = BLEND_MODE_OVERWRITE;

    const ledGeometry = new THREE.BoxGeometry(ledUnitSize, ledUnitSize, ledUnitSize);
    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(voxelUnitSize, voxelUnitSize, voxelUnitSize));

    const outlineMaterial = new THREE.LineBasicMaterial({color: 0xffffff});
    outlineMaterial.transparent = true;
    outlineMaterial.opacity = 0.1;

    const halfTranslationUnits = (voxelGridSize*voxelUnitSize)/2.0;
    const worldTranslation = new THREE.Vector3(-halfTranslationUnits, -halfTranslationUnits, -halfTranslationUnits);

    for (let x = 0; x < xSize; x++) {
      let currXArr = [];
      this.voxels.push(currXArr);
      for (let y = 0; y < ySize; y++) {
        let currYArr = [];
        currXArr.push(currYArr);
        for (let z = 0; z < zSize; z++) {

          const ledMatrial = new THREE.MeshBasicMaterial({color: 0x00ff00});
          ledMatrial.transparent = true;
          ledMatrial.opacity = 0.9;

          const ledMesh = new THREE.Mesh(ledGeometry, ledMatrial);
          const outlineMesh = new THREE.LineSegments(outlineGeometry, outlineMaterial);
              
          const currZObj = {
            xIndex: x,
            yIndex: y,
            zIndex: z,
            ledMesh: ledMesh,
            outlineMesh: outlineMesh,
            
            setColourRGB: function(r, g, b) { this.ledMesh.material.color.setRGB(r, g, b); },
            setColour: function(colour) { this.ledMesh.material.color.set(colour); },
            addColour: function(colour) { return this.ledMesh.material.color.add(colour); },
          };
            
          scene.add(ledMesh);
          scene.add(outlineMesh);
          
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

  voxelSizeInUnits() {
    return voxelUnitSize;
  }
  voxelGridSizeInUnits() {
    return voxelUnitSize * voxelGridSize;
  }
  voxelDisplayBox() {
    const minBound = 0;
    const maxBound = voxelGridSize-1;
    return new THREE.Box3(
      new THREE.Vector3(minBound,minBound,minBound), 
      new THREE.Vector3(maxBound,maxBound,maxBound)
    );
  }

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

  /**
   * Check whether the given point is in the local space bounds of this voxel display.
   * @param {THREE.Vector3} pt 
   */
  isInBounds(pt) {
    const roundedX = Math.round(pt.x);
    const roundedY = Math.round(pt.y);
    const roundedZ = Math.round(pt.z);

    return roundedX >= 0 && roundedX < this.voxels.length &&
      roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
      roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length;
  }

  setVoxel(pt, colour) {
    const roundedX = Math.round(pt.x);
    const roundedY = Math.round(pt.y);
    const roundedZ = Math.round(pt.z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      this.voxels[roundedX][roundedY][roundedZ].setColourRGB(colour.r, colour.g, colour.b);
    } 
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

  /**
   * Draw a coloured point (the point will be sampled to the nearest voxel).
   * @param {THREE.Vector3} pt - The position to draw the point at.
   * @param {THREE.Color} colour - The colour of the point
   */
  drawPoint(pt, colour) {
    switch (this.blendMode) {
      case BLEND_MODE_ADDITIVE:
        this.addToVoxel(pt, colour);
        break;
      case BLEND_MODE_OVERWRITE:
      default:
        this.setVoxel(pt, colour);
        break;
    }
  }

  /**
   * Draw a line through voxel space from the start point to the end point with the given colour.
   * @param {Vector3} p1 - The position where the line starts, in local coordinates.
   * @param {Vector3} p2 - The position where the line ends, in local coordinates.
   * @param {Color} colour - The colour of the line.
   */
  drawLine(p1, p2, colour) {
    // Code originally written by Anthony Thyssen, original algo of Bresenham's line in 3D
		// http://www.ict.griffith.edu.au/anthony/info/graphics/bresenham.procs

		let dx, dy, dz, l, m, n, dx2, dy2, dz2, i, x_inc, y_inc, z_inc, err_1, err_2;
		let currentPoint = new THREE.Vector3(p1.x, p1.y, p1.z);
		dx = p2.x - p1.x;
		dy = p2.y - p1.y;
		dz = p2.z - p1.z;
		x_inc = (dx < 0) ? -1 : 1;
		l = Math.abs(dx);
		y_inc = (dy < 0) ? -1 : 1;
		m = Math.abs(dy);
		z_inc = (dz < 0) ? -1 : 1;
		n = Math.abs(dz);
		dx2 = l * 2;
		dy2 = m * 2;
		dz2 = n * 2;

		if ((l >= m) && (l >= n)) {
			err_1 = dy2 - l;
			err_2 = dz2 - l;
			for (i = 0; i < l; i++) {
				this.drawPoint(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.y += y_inc;
					err_1 -= dx2;
				}
				if (err_2 > 0) {
					currentPoint.z += z_inc;
					err_2 -= dx2;
				}
				err_1 += dy2;
				err_2 += dz2;
				currentPoint.x += x_inc;
			}
    } 
    else if ((m >= l) && (m >= n)) {
			err_1 = dx2 - m;
			err_2 = dz2 - m;
			for (i = 0; i < m; i++) {
				this.drawPoint(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.x += x_inc;
					err_1 -= dy2;
				}
				if (err_2 > 0) {
					currentPoint.z += z_inc;
					err_2 -= dy2;
				}
				err_1 += dx2;
				err_2 += dz2;
				currentPoint.y += y_inc;
			}
    }
    else {
			err_1 = dy2 - n;
			err_2 = dx2 - n;
			for (i = 0; i < n; i++) {
        this.drawPoint(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.y += y_inc;
					err_1 -= dz2;
				}
				if (err_2 > 0) {
					currentPoint.x += x_inc;
					err_2 -= dz2;
				}
				err_1 += dy2;
				err_2 += dx2;
				currentPoint.z += z_inc;
			}
		}

		this.drawPoint(currentPoint, colour);
  }

}

export default VoxelDisplay;