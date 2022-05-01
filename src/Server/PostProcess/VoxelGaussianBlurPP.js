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

    const currFBTex = framebuffer.getGPUBuffer();
    const pingPongFBTex1 = gpuKernelMgr.blurXFunc(currFBTex, sqrSigma, conserveEnergy, alpha);
    currFBTex.delete();
    const pingPongFBTex2 = gpuKernelMgr.blurYFunc(pingPongFBTex1, sqrSigma, conserveEnergy, alpha);
    pingPongFBTex1.delete();
    const pingPongFBTex3 = gpuKernelMgr.blurZFunc(pingPongFBTex2, sqrSigma, conserveEnergy, alpha);
    pingPongFBTex2.delete();
    framebuffer.setBufferTexture(pingPongFBTex3);
  }
}

export default VoxelGaussianBlurPP;