
class VoxelPostProcess {
  constructor() {}

  willRender() {
    console.error("willRender unimplemented abstract method called.");
  }
  renderToFramebuffer(framebufferIn, framebufferOut) {
    console.error("renderToFramebuffer unimplemented abstract method called.");
  }
  
}
export default VoxelPostProcess;
