class SceneRenderer {
  constructor(scene, voxelModel) {
    this.scene = scene;
    this.voxelModel = voxelModel;
    this.timeCounter = 0;
  }
  clear() {
    this.scene.clear();
  }
  
  build() {}

  rebuild() {
    this.clear();
    this.build();
  }
}

export default SceneRenderer;