import VoxelPostProcess from "./VoxelPostProcess";

export const defaultDistortionConfig = {
  noiseAlpha: 1,          // Value in [0,1] for how visible the total white noise and tearing is
  noiseAxisMask: [0,1,0], // x,y,z axis mask 0 (no movement) or 1 (pos movement) or -1 (neg movement) for how the "tearing" noise moves
  noiseSpeed: 1,          // Speed of the noise, 1 feels natural but it can be slowed down or sped up, 0 results in no movement
  distortHorizontal: 1,   // Amount of horizontal tearing/distortion, 1 is a "reasonable" amount
  distortVertical:   1,   // Amount of vertical tearing/distortion, 1 is a "reasonable" amount
};

// Post-process filter for adding white noise, tearing, and distortion effects to create
// an effect that's similar to an old TV/CRT/VHS
class VoxelDistortionPP extends VoxelPostProcess {
  constructor(voxelModel, config={...defaultDistortionConfig}) {
    super(voxelModel);
    this.timeCounter = 0;
    this.setConfig(config);
  }

  setConfig(config) {
    if (!this._config) {
      this.voxelModel.gpuKernelMgr.initDistortionPPKernels(this.voxelModel.gridSize);
    }
    this._config = this._config ? {...this._config, ...config} : config;
  }

  willRender() {
    const {noiseAlpha, noiseAxisMask, distortHorizontal, distortVertical} = this._config;
    return distortHorizontal > 0 || distortVertical > 0 || 
      (noiseAlpha > 0 && (noiseAxisMask[0] !== 0 || noiseAxisMask[1] !== 0 || noiseAxisMask[2] !== 0));
  }

  renderToFramebuffer(dt, framebuffer) {
    const {gpuKernelMgr} = this.voxelModel;
    const {noiseAlpha, noiseSpeed, noiseAxisMask, distortHorizontal, distortVertical} = this._config;
    this.timeCounter += dt;

    const currFBTex = framebuffer.getGPUBuffer();
    const pingPongFBTex = gpuKernelMgr.distortionFunc(
      currFBTex, this.timeCounter, noiseAlpha, noiseAxisMask, noiseSpeed, distortHorizontal, distortVertical
    );
    currFBTex.delete();
    framebuffer.setBufferTexture(pingPongFBTex);
  }

}

export default VoxelDistortionPP;
