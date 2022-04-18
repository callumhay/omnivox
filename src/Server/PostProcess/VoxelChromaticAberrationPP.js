
import VoxelPostProcess from './VoxelPostProcess';

export const defaulChromaticAberrationConfig = {
  intensity: 1, // Intensity of the aberration effect
};

class VoxelChromaticAberrationPP extends VoxelPostProcess {
  constructor(voxelModel, config={...defaulChromaticAberrationConfig}) {
    super();
    this.voxelModel = voxelModel;
    this.setConfig(config);
  }

  setConfig(config) {
    if (!this._config) {
      this.voxelModel.gpuKernelMgr.initChromaticAberrationPPKernels(this.voxelModel.gridSize);
    }
    this._config = this._config ? {...this._config, ...config} : config;
  }

  willRender() {
    const {intensity} = this._config;
    return intensity !== 0;
  }

  renderToFramebuffer(framebufferIn, framebufferOut) {
    const {intensity} = this._config;
    const {gpuKernelMgr} = this.voxelModel;

    const currFBTex = framebufferIn.getGPUBuffer();
    const pingPongFBTex1 = gpuKernelMgr.chromaticAberrationFunc(currFBTex, intensity);
    if (framebufferIn === framebufferOut) { currFBTex.delete(); }
    framebufferOut.setBufferTexture(pingPongFBTex1);
  }

}

export default VoxelChromaticAberrationPP;