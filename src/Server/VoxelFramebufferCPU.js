import VoxelFramebuffer from './VoxelFramebuffer';
import VoxelModel, {BLEND_MODE_ADDITIVE, BLEND_MODE_OVERWRITE} from './VoxelModel';
import {clamp} from '../MathUtils';

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

  drawBox(minPt, maxPt, colour, fill, blendMode) {
    const gridSize = this._buffer.length;
    const boxPts = VoxelModel.voxelBoxList(minPt, maxPt, fill, VoxelModel.voxelBoundingBox(gridSize, gridSize, gridSize));
    const blendDrawPointFunc = this._getBlendFuncNoCheck(blendMode);
    const colourArr = [colour.r, colour.g, colour.b];

    boxPts.forEach((pt) => {
      blendDrawPointFunc([pt.x, pt.y, pt.z], colourArr);
    });
  }

  drawSphere(center, radius, colour, fill, blendMode) {
    const gridSize = this._buffer.length;
    const spherePts = VoxelModel.voxelSphereList(center, radius, fill, VoxelModel.voxelBoundingBox(gridSize, gridSize, gridSize));
    const blendDrawPointFunc = this._getBlendFuncNoCheck(blendMode);
    const colourArr = [colour.r, colour.g, colour.b];

    spherePts.forEach((pt) => {
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