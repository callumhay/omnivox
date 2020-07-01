
class SceneRenderer {
  constructor(scene, voxelModel) {
    this.scene = scene;
    this.voxelModel = voxelModel;
    this.timeCounter = 0;
    this.crossfadeAlpha = 1;
  }
  clear() {
    this.scene.dispose();
    this._options = null;
  }

  build(options) {}

  rebuild(options) {
    this.clear();
    this.build(options);
    this._options = options;
  }

  crossfade(alpha) {
    this.crossfadeAlpha = alpha;
  }
}

export default SceneRenderer;