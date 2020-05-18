
/*
const VoxelSceneDefaultConfig = {
  debug: {
    camera: {
      fov: 70,
      aspect: 800/600,
      position: {x:0,y:0,z:10},
      direction: {x:0,y:0,z:-1},
    },
  },
};
class VoxelScene {
  constructor(voxelModel, config=VoxelSceneDefaultConfig) {

    this.voxelModel = voxelModel;
    this.debugRenderer = new WebGLRenderer();
    this.debugRenderTarget = null;
    this.debugCamera = null;

    this.setConfig(config);
  
    // Create a default THREE.js scene that we can use to debug the raytracer
    // this will show the rasterized version of the scene based on the perspective of a camera
    // coming from the browser viewer
    const setupDebugScene = () => {
      // Scene used for holding objects for raytracing and rendering debug stuff
      this.scene = new THREE.Scene();

      let geometry = new THREE.TorusKnotBufferGeometry(3, 1, 256, 32);
      let material = new THREE.MeshStandardMaterial({color: 0x6083c2});
  
      let mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
  
      let ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
      this.scene.add(ambientLight);
  
      let pointLight = new THREE.PointLight(0xffffff, 0.8);
      this.debugCamera.add(pointLight);
  
      this.scene.add(this.debugCamera);
    };
    setupDebugScene();
  }

  setConfig(c) {
    const {fov, aspect, position, direction} = c.debug.camera;
    if (!this.debugCamera) {
      this.debugCamera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    }
    this.debugCamera.fov = fov;
    this.debugCamera.aspect = aspect;
    this.debugCamera.updateProjectionMatrix();

    const posVec3 = new THREE.Vector3(position.x, position.y, position.z);
    this.debugCamera.position.set(position.x, position.y, position.z);
    this.debugCamera.lookAt(posVec3.clone().add(new THREE.Vector3(direction.x, direction.y, direction.z)));

    const newRenderSizeX = aspect * DEBUG_CAMERA_RENDER_TARGET_SIZE_HEIGHT;
    if (!this.debugRenderTarget) {
      this.debugRenderTarget = new THREE.WebGLRenderTarget(newRenderSizeX, DEBUG_CAMERA_RENDER_TARGET_SIZE_HEIGHT, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBFormat,
      });
    }
    this.debugRenderTarget.setSize(newRenderSizeX, DEBUG_CAMERA_RENDER_TARGET_SIZE_HEIGHT);
  }

  render(dt) {
    
    // Debug rendering for the viewer (so we can see what the scene looks like without voxelizing it)
    this.debugRenderer.setRenderTarget(this.debugRenderTarget);
    this.debugRenderer.clear();
    this.debugRenderer.render(this.scene, this.debugCamera);
    this.debugRenderer.copyFramebufferToTexture(ZERO_VEC2, this.sceneTexture);
  }
}
*/