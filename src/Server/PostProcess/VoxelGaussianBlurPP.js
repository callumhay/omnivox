import VoxelPostProcess from './VoxelPostProcess';

export const defaultGaussianBlurConfig = {
  kernelSize: 3,          // Size of the blur kernel
  sqrSigma: 0.2,          // Standard deviation of the kernel (gaussian distribution's sigma squared)
  conserveEnergy: false,  // Whether we normalize the resulting kernel values (true if normalized)
};

class VoxelGaussianBlurPP extends VoxelPostProcess {
  constructor(voxelModel, config={...defaultGaussianBlurConfig}) {
    super();
    this.voxelModel = voxelModel;
    this.setConfig(config);
  }

  setConfig(config) {
    if (!this._config || (config.kernelSize && this._config.kernelSize !== config.kernelSize)) {
      this.voxelModel.gpuKernelMgr.initGaussianBlurPPKernels(this.voxelModel.gridSize, config.kernelSize);
    }
    this._config = this._config ? {...this._config, ...config} : config;
  }

  renderToFramebuffer(framebufferIn, framebufferOut) {
    const {sqrSigma, conserveEnergy} = this._config;
    const {gpuKernelMgr} = this.voxelModel;

    const currFBTex = framebufferIn.getGPUBuffer();
    const pingPongFBTex1 = gpuKernelMgr.blurXFunc(currFBTex, sqrSigma, conserveEnergy);
    if (framebufferIn === framebufferOut) { currFBTex.delete(); }
    const pingPongFBTex2 = gpuKernelMgr.blurYFunc(pingPongFBTex1, sqrSigma, conserveEnergy);
    pingPongFBTex1.delete();
    const pingPongFBTex3 = gpuKernelMgr.blurZFunc(pingPongFBTex2, sqrSigma, conserveEnergy);
    pingPongFBTex2.delete();
    framebufferOut.setBufferTexture(pingPongFBTex3);
  }
}

export default VoxelGaussianBlurPP;