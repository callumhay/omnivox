
class VoxelPostProcess {
  constructor() {}

  willRender() {
    console.error("willRender unimplemented abstract method called.");
  }
  renderToFramebuffer(framebuffer) {
    console.error("renderToFramebuffer unimplemented abstract method called.");
  }
  
}
export default VoxelPostProcess;
