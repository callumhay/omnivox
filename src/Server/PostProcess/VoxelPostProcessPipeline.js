import VoxelModel, {BLEND_MODE_OVERWRITE} from '../VoxelModel';

class VoxelPostProcessPipeline {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;
    this._postProcesses = [];
  }

  addPostProcess(postProcess) {
    this._postProcesses.push(postProcess);
  }
  removePostProcess(postProcess) {
    const idx = this._postProcesses.indexOf(postProcess);
    if (idx > -1) { this._postProcesses.splice(idx, 1); }
  }

  render(fbOriginIdx, fbTargetIdx) {
    if (this._postProcesses.length === 0 || this._postProcesses.filter(pp => pp.willRender()).length === 0) {
      this.voxelModel.setFramebuffer(fbTargetIdx);
      return;
    } 

    // Draw the origin framebuffer into our post-processing framebuffer
    this.voxelModel.setFramebuffer(VoxelModel.GPU_FRAMEBUFFER_IDX_2); // Always use GPU_FRAMEBUFFER_IDX_2 for post processing
    this.voxelModel.clear();
    this.voxelModel.drawFramebuffer(fbOriginIdx, BLEND_MODE_OVERWRITE);

    const ppFramebuffer = this.voxelModel.framebuffer;
    for (const postProcess of this._postProcesses) {
      postProcess.renderToFramebuffer(ppFramebuffer);
    }

    // Draw the post-processed buffer back into the target framebuffer
    this.voxelModel.setFramebuffer(fbTargetIdx);
    this.voxelModel.drawFramebuffer(VoxelModel.GPU_FRAMEBUFFER_IDX_2, BLEND_MODE_OVERWRITE);
  }
}

export default VoxelPostProcessPipeline;
