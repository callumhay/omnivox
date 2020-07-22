import VoxelFramebuffer from './VoxelFramebuffer';
import VoxelModel, {BLEND_MODE_ADDITIVE, BLEND_MODE_OVERWRITE} from './VoxelModel';

class VoxelFramebufferGPU extends VoxelFramebuffer {
  constructor(index, gpuKernelMgr) {
    super(index);

    this.gpuKernelMgr = gpuKernelMgr;
    this._bufferTexture = this.gpuKernelMgr.clearFunc([0,0,0]);
  }

  getType() { return VoxelFramebuffer.VOXEL_FRAMEBUFFER_GPU_TYPE; }

  getBuffer() { return this._bufferTexture; }
  getCPUBuffer() { return this._bufferTexture.toArray(); }
  getGPUBuffer() { return this._bufferTexture; }

  setVoxel(pt, colour) {
    console.error("setVoxel called on GPU Framebuffer.");
  } 
  addToVoxel(pt, colour) {
    console.error("addToVoxel called on GPU Framebuffer.");
  }

  clear(colour) {
    this._bufferTexture = this.gpuKernelMgr.clearFunc(colour);
  }

  drawFramebuffer(framebuffer, blendMode) {
    const bufferToDraw = framebuffer.getGPUBuffer();
    switch (blendMode) {
      case BLEND_MODE_ADDITIVE:
        this._bufferTexture = this.gpuKernelMgr.addFramebuffersFunc(this._bufferTexture, bufferToDraw);
        break;
      case BLEND_MODE_OVERWRITE:
        this._bufferTexture = this.gpuKernelMgr.copyFramebufferFunc(bufferToDraw);
        break;
      default:
        console.log("Invalid blend mode.");
        break;
    }

    if (framebuffer.getType() === VoxelFramebuffer.VOXEL_FRAMEBUFFER_CPU_TYPE) {
      bufferToDraw.delete();
    }
  }

  drawCombinedFramebuffers(fb1, fb2, options) {
    switch (options.mode) {
      case VoxelModel.FB1_ALPHA_FB2_ONE_MINUS_ALPHA: {
        const fb1GPUBuffer = fb1.getGPUBuffer();
        const fb2GPUBuffer = fb2.getGPUBuffer();

        this._bufferTexture = this.gpuKernelMgr.combineFramebuffersAlphaOneMinusAlphaFunc(fb1GPUBuffer, fb2GPUBuffer, options.alpha, 1.0-options.alpha);

        if (fb1.getType() === VoxelFramebuffer.VOXEL_FRAMEBUFFER_CPU_TYPE) {
          fb1GPUBuffer.delete();
        }
        if (fb2.getType() === VoxelFramebuffer.VOXEL_FRAMEBUFFER_CPU_TYPE) {
          fb2GPUBuffer.delete();
        }

        break;
      }
       
      default:
        console.log("Invalid framebuffer combination mode.");
        break;
    }
  }

  drawPoint(pt, colour, blendMode) { console.error("drawPoint called on GPU Framebuffer."); }
  drawBox(minPt, maxPt, colour, fill, blendMode) { console.error("drawBox called on GPU Framebuffer."); }
  drawSphere(center, radius, colour, fill, blendMode) { console.error("drawSphere called on GPU Framebuffer."); }

  drawSpheres(center, radii, colours, brightness) {
    const radiiSqr = radii.map(r => r*r);
    const originalBuffer = this._bufferTexture;
    this._bufferTexture = this.gpuKernelMgr.spheresFillOverwrite(originalBuffer, center, radiiSqr, colours, brightness);
  }
  drawCubes(center, radii, colours, brightness) {
    const originalBuffer = this._bufferTexture;
    this._bufferTexture = this.gpuKernelMgr.cubesFillOverwrite(originalBuffer, center, radii, colours, brightness);
  }

  drawFire(fireLookup, temperatureArr, offsetXYZ) {
    this._bufferTexture = this.gpuKernelMgr.fireOverwrite(fireLookup, temperatureArr, offsetXYZ);
  }

}

export default VoxelFramebufferGPU;