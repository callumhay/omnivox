class SceneRenderer {
  constructor(scene, voxelModel) {
    this.scene = scene;
    this.voxelModel = voxelModel;
  }
  
  load() {}
  unload() {}

  setOptions(options) { this._options = options; }

  rebuild(options) {
    this.clear();
    this.setOptions(options);
  }

  clear() {
    this.scene.clear();
    this._options = null;
  }

  rendersToCPUOnly() { return true; }
  
  async render(dt) {}
}

export default SceneRenderer;
