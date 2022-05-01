// Abstract super class for post processing pipeline effects
class VoxelPostProcess {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;
  }

  setConfig(config) { console.error("setConfig unimplemented abstract method called."); }
  willRender() { console.error("willRender unimplemented abstract method called."); }
  renderToFramebuffer(dt, framebuffer) { console.error("renderToFramebuffer unimplemented abstract method called."); }
  
}
export default VoxelPostProcess;
