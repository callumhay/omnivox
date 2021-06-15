



class VoxelFramebuffer {
  constructor(index) {
    this._index = index;
  }
  get index() { return this._index; }

  static get VOXEL_FRAMEBUFFER_CPU_TYPE() { return 0; }
  static get VOXEL_FRAMEBUFFER_GPU_TYPE() { return 1; }

  getType() { console.error("getType abstract method call"); return null; }

  getBuffer()    { console.error("getBuffer abstract method call."); return null; }
  getCPUBuffer() { console.error("getCPUBuffer abstract method call."); return null; }
  getGPUBuffer() { console.error("getGPUBuffer abstract method call."); return null; }

  // Implemented in child classes
  setVoxel(pt, colour) { console.error("setVoxel abstract method call."); } 
  addToVoxel(pt, colour) { console.error("addToVoxel abstract method call."); }
  addToVoxelFast(pt, colour) { console.error("addToVoxelFast abstract method call."); }

  clear(colour) { console.error("clear abstract method call."); }

  drawFramebuffer(framebuffer, blendMode) { console.error("drawFramebuffer abstract method call."); }
  drawCombinedFramebuffers(fb1, fb2, options) { console.error("drawCombinedFramebuffers abstract method call."); }

  drawPoint(pt, colour, blendMode) { console.error("drawPoint abstract method call."); }
  drawAABB(minPt, maxPt, colour, fill, blendMode) { console.error("drawAABB abstract method call."); }
  drawSphere(center, radius, colour, fill, blendMode) { console.error("drawSphere abstract method call."); }
  drawSpheres(center, radii, colours, brightness) { console.error("drawSpheres abstract method call."); }
  drawCubes(center, radii, colours, brightness) { console.error("drawCubes abstract method call."); }
}

export default VoxelFramebuffer;

