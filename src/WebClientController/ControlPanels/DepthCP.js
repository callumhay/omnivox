
import * as THREE from 'three';

import VoxelAnimator from "../../Animation/VoxelAnimator";

import MasterCP from './MasterCP';
import AnimCP from "./AnimCP";


class DepthCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {});

    this.depthVideoTexture = null;
    this.depthVideo = null;
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_DEPTH; }

  buildFolder() {
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Video Options"});
    const self = this;

    if (!this.localConfig) {
      this.localConfig = {
        showDebugBuffer: false,
      };
    }

    /*
    // TODO
    folder.addInput(this.localConfig, 'showDebugBuffer', {label: "Show Debug Buffer?"}).on(CHANGE_EVENT, ev => {
      if (!self.minmapRenderer) { return; }
      if (document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).contains(self.minmapRenderer.domElement)) {
        document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).removeChild(self.minmapRenderer.domElement);
      }
      if (ev.value) { document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).appendChild(self.minmapRenderer.domElement); }
    });
    */

    return folder;
  }

  async onLoadControls() {
    super.onLoadControls();
    const depthCamInfo = await DepthCP._loadDepthCamera();
    if (!depthCamInfo) { console.warn("Failed to load depth camera stream."); return; }

    const {stream, width, height} = depthCamInfo;

    this.depthVideo = document.createElement("video");
    this.depthVideo.style.maxWidth  = width;
    this.depthVideo.style.maxHeight = height;
    //this.depthVideo.style.display = "hidden";
    this.depthVideo.crossOrigin = "anonymous";
    if ('srcObject' in this.depthVideo) {
      try { this.depthVideo.srcObject = stream; }
      catch (err) {
        if (err.name !== "TypeError") { throw err; }
        this.depthVideo.src = URL.createObjectURL(stream);
      }
    }
    else {
      this.depthVideo.src = URL.createObjectURL(stream);
    }
    document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).appendChild(this.depthVideo);

    this.depthTexture = new THREE.VideoTexture(
      this.depthVideo, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping
    );

    const camera = new THREE.OrthographicCamera(0,width,height,0,0,1);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.margin = "auto";
    document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).appendChild(this.renderer.domElement);

    const RENDER_DEPTH_TEX_FS = `
      uniform sampler2D depthTexture;
    
      void main() {
        //gl_FragColor = vec4(1,0,0,1);
        gl_FragColor = vec4(texture2D(depthTexture, gl_PointCoord).rrr, 1.0);
      }
    `;
    const material = new THREE.ShaderMaterial({
      uniforms: { depthTexture: { value: this.depthTexture } },
      fragmentShader: RENDER_DEPTH_TEX_FS,
      depthTest: false,
    });

    this.scene = new THREE.Scene();
    this.fsQuad = new THREE.Mesh(new THREE.PlaneBufferGeometry(width,height,1,1),  material);
    this.scene.add(this.fsQuad);

    const self = this;
    const animate = () => {
      if (!self.depthVideo || !self.depthTexture) { return; }
      requestAnimationFrame(animate);
      self.fsQuad.position.set(width/2, height/2, 0);
      self.renderer.render(self.scene, camera);
    }
    animate();

    document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).style.display = "inherit";
  }

  onUnloadControls() {
    super.onUnloadControls();

    if (this.depthTexture) {
      this.depthTexture.dispose();
      this.depthTexture = null;
    }
    if (this.depthVideo) {
      if (document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).contains(this.depthVideo)) {
        document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).removeChild(this.depthVideo);
      }
      this.depthVideo = null;
    }
    document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).style.display = "none";

  }
  
  static async _loadDepthCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("Your browser doesn't support the required mediaDevices APIs.");
      return null;
    }

    // Enumerate the devices - try to find a RealSense (depth) camera
    let foundDevice = null;
    const devices = await navigator.mediaDevices.enumerateDevices();
    for (const device of devices) {
      if (device.label.indexOf("RealSense") !== -1) {
        foundDevice = device;
      }
    }
    if (foundDevice === null) {
      console.warn("No RealSense camera connected.");
      return null;
    }

    const capabilities = foundDevice.getCapabilities();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: foundDevice.deviceId }
    });

    return {
      stream, 
      width: capabilities.width.max, 
      height: capabilities.height.max
    };
  }

}

export default DepthCP;
