import * as THREE from 'three';

import VoxelFramebuffer from './VoxelFramebuffer';
import {BLEND_MODE_ADDITIVE, BLEND_MODE_OVERWRITE} from './VoxelModel';
import {clamp} from '../MathUtils';
import VoxelGeometryUtils from '../VoxelGeometryUtils';

const tempVec3 = new THREE.Vector3();

class VoxelFramebufferCPU extends VoxelFramebuffer {
  constructor(index, gridSize, gpuKernelMgr) {
    super(index);

    this.gridSize = gridSize;
    this.gpuKernelMgr = gpuKernelMgr;

    // Build the 3D array of voxels for the _buffer itself
    this._buffer = [];
    for (let x = 0; x < gridSize; x++) {
      let currXArr = [];
      this._buffer.push(currXArr);
      for (let y = 0; y < gridSize; y++) {
        let currYArr = [];
        currXArr.push(currYArr);
        for (let z = 0; z < gridSize; z++) {
          currYArr.push([0,0,0]);
        }
      }
    }
  }

  getType() { return VoxelFramebuffer.VOXEL_FRAMEBUFFER_CPU_TYPE; }

  getBuffer() { return this._buffer; }
  getCPUBuffer() { return this._buffer; }
  getGPUBuffer() { return this.gpuKernelMgr.copyFramebufferFuncImmutable(this._buffer); } // NOTE: The resulting texture must be deleted by calling delete() on it!

  _setVoxelNoCheck(pt, colour) {
    const voxelColour = this._buffer[pt[0]][pt[1]][pt[2]];
    voxelColour[0] = colour[0];
    voxelColour[1] = colour[1];
    voxelColour[2] = colour[2];
  }

  setVoxel(pt, colour) {
    const adjustedX = Math.floor(pt[0]);
    const adjustedY = Math.floor(pt[1]);
    const adjustedZ = Math.floor(pt[2]);

    if (adjustedX >= 0 && adjustedX < this.gridSize &&
        adjustedY >= 0 && adjustedY < this.gridSize &&
        adjustedZ >= 0 && adjustedZ < this.gridSize) {
      this._setVoxelNoCheck([adjustedX, adjustedY, adjustedZ], colour);
    } 
  }

  _addToVoxelNoCheck(pt, colour) {
    const voxelColour = this._buffer[pt[0]][pt[1]][pt[2]];
    voxelColour[0] = clamp(voxelColour[0] + colour[0], 0, 1);
    voxelColour[1] = clamp(voxelColour[1] + colour[1], 0, 1);
    voxelColour[2] = clamp(voxelColour[2] + colour[2], 0, 1);
  }

  addToVoxel(pt, colour) {
    const adjustedX = Math.floor(pt[0]);
    const adjustedY = Math.floor(pt[1]);
    const adjustedZ = Math.floor(pt[2]);

    if (adjustedX >= 0 && adjustedX < this.gridSize &&
        adjustedY >= 0 && adjustedY < this.gridSize &&
        adjustedZ >= 0 && adjustedZ < this.gridSize) {
      this._addToVoxelNoCheck([adjustedX, adjustedY, adjustedZ], colour);
    } 
  }
  addToVoxelFast(pt, colour) { this._addToVoxelNoCheck(pt, colour); }

  clear(colour) {
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        for (let z = 0; z < this.gridSize; z++) {
          const voxelColour = this._buffer[x][y][z];
          voxelColour[0] = colour[0];
          voxelColour[1] = colour[1];
          voxelColour[2] = colour[2];
        }
      }
    }
  }

  drawFramebuffer(framebuffer, blendMode) {
    const bufferToDraw = framebuffer.getCPUBuffer();
    const blendFunc = this._getBlendFuncNoCheck(blendMode);

    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        for (let z = 0; z < this.gridSize; z++) {
          blendFunc([x,y,z], bufferToDraw[x][y][z]);
        }
      }
    }
  }

  drawCombinedFramebuffers(fb1, fb2, options) {
    console.error("drawCombinedFramebuffers called on CPU Framebuffer.");
  }

  drawPoint(pt, colour, blendMode) {
    const blendFunc = this._getBlendFunc(blendMode);
    blendFunc(pt, colour);
  }
  drawPointNoCheck(pt, colour, blendMode) {
    const blendFunc = this._getBlendFuncNoCheck(blendMode);
    blendFunc(pt, colour);
  }

  drawAABB(minPt, maxPt, colour, fill, blendMode) {
    const gridSize = this._buffer.length;
    const boxPts = VoxelGeometryUtils.voxelAABBList(minPt, maxPt, fill, VoxelGeometryUtils.voxelBoundingBox(gridSize));
    const blendDrawPointFunc = this._getBlendFuncNoCheck(blendMode);
    const colourArr = [colour.r, colour.g, colour.b];

    boxPts.forEach((pt) => {
      blendDrawPointFunc([pt.x, pt.y, pt.z], colourArr);
    });
  }

  drawSphere(center, radius, colour, fill, blendMode) {
    const gridSize = this._buffer.length;
    const spherePts = VoxelGeometryUtils.voxelSphereList(center, radius, fill, VoxelGeometryUtils.voxelBoundingBox(gridSize));
    const blendDrawPointFunc = this._getBlendFuncNoCheck(blendMode);
    const colourArr = [colour.r, colour.g, colour.b];

    spherePts.forEach((pt) => {
      blendDrawPointFunc([pt.x, pt.y, pt.z], colourArr);
    });
  }

  drawSpheres(center, radii, colours, brightness) { 
    const blendDrawPointFunc = this._getBlendFuncNoCheck(BLEND_MODE_OVERWRITE);
    const VOXEL_ERR_UNITS_SQR = VoxelConstants.VOXEL_ERR_UNITS*VoxelConstants.VOXEL_ERR_UNITS;
    const radiiSqr = radii.map(r => r*r);
    const centerVec3 = new THREE.Vector3(center[0], center[1], center[2]);

    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        for (let z = 0; z < this.gridSize; z++) {
          // Find the sqr dist to the current voxel
          tempVec3.set(x,y,z);
          const sqrDist = centerVec3.distanceToSquared(tempVec3);
          // Find the smallest coloured sphere to draw in the current voxel
          for (let i = 0; i < radii.length; i++) {
            if (sqrDist <= (radiiSqr[i] + VOXEL_ERR_UNITS_SQR)) {
              const currColour = colours[i];
              blendDrawPointFunc([x,y,z], [brightness*currColour[0], brightness*currColour[1], brightness*currColour[2]]);
              break;
            }
          }
        }
      }
    }
  }

  drawBox(center, eulerRot, size, colour, fill, blendMode) {
    const halfSize = size.clone().multiplyScalar(0.5);
    // Figure out all the points in the grid that will be inside the box...
    const minPt = center.clone();
    const maxPt = center.clone();
    minPt.sub(halfSize);
    maxPt.add(halfSize);

    const boxPts = VoxelGeometryUtils.voxelAABBList(minPt, maxPt, fill, VoxelGeometryUtils.voxelBoundingBox(gridSize));
    const blendDrawPointFunc = this._getBlendFuncNoCheck(blendMode);
    const colourArr = [colour.r, colour.g, colour.b];

    // Transform all the box points by the rotation, make sure we're doing this from the given center point...
    if (eulerRot.x !== 0 || eulerRot.y !== 0 || eulerRot.z !== 0) {
      for (let i = 0; i < boxPts.length; i++) {
        const boxPt = boxPts[i];
        boxPt.sub(center); // Bring the point to the origin...
        boxPt.applyEuler(eulerRot); // Rotate it
        boxPt.add(center); // Move back to where the box is
      }
    }

    // Draw the box
    boxPts.forEach((pt) => {
      blendDrawPointFunc([pt.x, pt.y, pt.z], colourArr);
    });
  }

  _getBlendFunc(blendMode) {
    return (blendMode === BLEND_MODE_ADDITIVE ? this.addToVoxel : this.setVoxel).bind(this);
  }
  _getBlendFuncNoCheck(blendMode) {
    return (blendMode === BLEND_MODE_ADDITIVE ? this._addToVoxelNoCheck : this._setVoxelNoCheck).bind(this);
  }
}

export default VoxelFramebufferCPU;