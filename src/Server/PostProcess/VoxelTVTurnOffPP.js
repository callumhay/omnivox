import VoxelPostProcess from "./VoxelPostProcess";

export const defaultTVTurnOffConfig = {
  offAmount: 0 // Ranges from 0 (no effect) to 1 (completely turned off)
};

class VoxelTVTurnOffPP extends VoxelPostProcess {
  constructor(voxelModel, config={...defaultTVTurnOffConfig}) {
    super(voxelModel);
    this.setConfig(config);
  }

  setConfig(config) {
    if (!this._config) {
      this.voxelModel.gpuKernelMgr.initTVTurnOffPPKernels(this.voxelModel.gridSize);
    }
    this._config = this._config ? {...this._config, ...config} : config;
  }

  willRender() {
    const {offAmount} = this._config;
    return (offAmount > 0);
  }

  renderToFramebuffer(dt, framebuffer) {
    const {gpuKernelMgr} = this.voxelModel;
    const {offAmount} = this._config;
    const pingPongFBTex = gpuKernelMgr.tvTurnOffFunc(framebuffer.getGPUBuffer(), offAmount);
    framebuffer.setBufferTexture(pingPongFBTex);
  }

}

export default VoxelTVTurnOffPP;