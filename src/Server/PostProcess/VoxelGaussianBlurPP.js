import VoxelPostProcess from './VoxelPostProcess';

export const defaultGaussianBlurConfig = {
  kernelSize: 3,          // Size of the blur kernel
  sqrSigma: 0.2,          // Standard deviation of the kernel (gaussian distribution's sigma squared)
  conserveEnergy: false,  // Whether we normalize the resulting kernel values (true if normalized)
  alpha: 1,               // How much the blur is visible (multiplies all but the center of the kernel)
};

class VoxelGaussianBlurPP extends VoxelPostProcess {
  constructor(voxelModel, config={...defaultGaussianBlurConfig}) {
    super(voxelModel);
    this.setConfig(config);
  }

  setConfig(config) {
    if (!this._config || (config.kernelSize && this._config.kernelSize !== config.kernelSize)) {
      this.voxelModel.gpuKernelMgr.initGaussianBlurPPKernels(this.voxelModel.gridSize, config.kernelSize);
    }
    this._config = this._config ? {...this._config, ...config} : config;
  }

  willRender() {
    const {sqrSigma, alpha} = this._config;
    return (sqrSigma > 0 && alpha > 0);
  }

  renderToFramebuffer(dt, framebuffer) {
    const {sqrSigma, conserveEnergy, alpha} = this._config;
    const {gpuKernelMgr} = this.voxelModel;

    let pingTex = null, pongTex = null;

    pingTex = gpuKernelMgr.blurXFunc(framebuffer.getGPUBuffer(), sqrSigma, conserveEnergy, alpha);
    pongTex = gpuKernelMgr.blurYFunc(pingTex, sqrSigma, conserveEnergy, alpha);
    pingTex = gpuKernelMgr.blurZFunc(pongTex, sqrSigma, conserveEnergy, alpha);
    
    framebuffer.setBufferTexture(pingTex);
  }
}

export default VoxelGaussianBlurPP;