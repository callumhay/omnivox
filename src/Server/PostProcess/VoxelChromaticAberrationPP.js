
import VoxelPostProcess from './VoxelPostProcess';

export const defaulChromaticAberrationConfig = {
  intensity: 1,     // Intensity of the aberration effect
  alpha: 1,
  xyzMask: [1,1,1], // Multiplies the intensity along the x,y,z axis to offset in a particular direction
};

class VoxelChromaticAberrationPP extends VoxelPostProcess {
  constructor(voxelModel, config={...defaulChromaticAberrationConfig}) {
    super(voxelModel);
    this.setConfig(config);
  }

  setConfig(config) {
    if (!this._config) {
      this.voxelModel.gpuKernelMgr.initChromaticAberrationPPKernels(this.voxelModel.gridSize);
    }
    this._config = this._config ? {...this._config, ...config} : config;
  }

  willRender() {
    const {intensity, alpha} = this._config;
    return intensity !== 0 && alpha !== 0;
  }

  renderToFramebuffer(dt, framebuffer) {
    const {intensity, alpha, xyzMask} = this._config;
    const {gpuKernelMgr} = this.voxelModel;

    const chromaticAberrTex = gpuKernelMgr.chromaticAberrationFunc(framebuffer.getGPUBuffer(), intensity, alpha, xyzMask);
    framebuffer.setBufferTexture(chromaticAberrTex);
  }

}

export default VoxelChromaticAberrationPP;