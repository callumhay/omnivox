
class SceneRenderer {
  constructor(scene, voxelModel) {
    this.scene = scene;
    this.voxelModel = voxelModel;
    this.timeCounter = 0;
  }
  
  clear() {
    this.scene.clear();
    this._options = null;
  }

  rendersToCPUOnly() { return true; }

  build(options) {}

  rebuild(options) {
    this.clear();
    this.build(options);
    this._options = options;
  }
}

export default SceneRenderer;