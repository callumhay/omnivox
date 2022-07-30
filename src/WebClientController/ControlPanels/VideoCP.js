import * as THREE from 'three';

import VoxelAnimator from "../../Animation/VoxelAnimator";
import { videoAnimatorDefaultConfig } from '../../Animation/VideoAnimator';

import { CHANGE_EVENT } from '../controlpanelfuncs';

import AnimCP from "./AnimCP";
import MasterCP from './MasterCP';

const VIDEO_PATH = "./video/";
const MAX_VIDEO_DISPLAY_SIZE = "640px";

class VideoCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...videoAnimatorDefaultConfig});

    this.videoElement = null;

    // THREE.js stuff
    this.scene = null;
    this.videoTexture = null;
    this.fsQuad = null;
    this.minmapRenderer = null;
    this.renderTarget = null;
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_VIDEO; }

  buildFolder() {
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Video Options"});
    const self = this;

    if (!this.localConfig) {
      this.localConfig = {
        showDebugBuffer: false,
        videoFilename: "rick_and_morty.webm",
      };
    }

    this.addControl(folder, 'movingFramebuffer', {label: "Show Moving Framebuffer?"});
    this.addControl(folder, 'fps', {label: "Moving Slices Per Second", min:1, max:60, step:1});
    folder.addInput(this.localConfig, 'videoFilename', {label: "Video File"}).on(CHANGE_EVENT, ev => {
      if (!this.videoElement) { return; }
      // Check if the file is a link...
      const isLinkRegEx = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/;
      this.videoElement.src = ev.value.match(isLinkRegEx) === null ? (VIDEO_PATH + ev.value) : ev.value;
    });

    folder.addInput(this.localConfig, 'showDebugBuffer', {label: "Show Debug Buffer?"}).on(CHANGE_EVENT, ev => {
      if (!self.minmapRenderer) { return; }
      if (document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).contains(self.minmapRenderer.domElement)) {
        document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).removeChild(self.minmapRenderer.domElement);
      }
      if (ev.value) { document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).appendChild(self.minmapRenderer.domElement); }
    });

    return folder;
  }

  onLoadControls() {
    super.onLoadControls();

    this.videoElement = document.createElement("video");
    this.videoElement.style.maxWidth = MAX_VIDEO_DISPLAY_SIZE;
    this.videoElement.style.maxHeight = MAX_VIDEO_DISPLAY_SIZE;
    this.videoElement.controls = true;
    this.videoElement.crossOrigin = "anonymous";
    this.videoElement.src = VIDEO_PATH + this.localConfig.videoFilename;
    document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).appendChild(this.videoElement);

    // We use THREE.js to do our downsampling (minmapping) of the video to a gridSize x gridSize buffer
    const rtWidth = this.masterCP.gridSize;
    const rtHeight = rtWidth;
    this.renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight);
    this.minmapRenderer = new THREE.WebGLRenderer();
    this.minmapRenderer.setSize(rtWidth, rtHeight);
    this.minmapRenderer.domElement.style.margin = "20px auto";
    if (this.localConfig.showDebugBuffer) {
      document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).appendChild(self.minmapRenderer.domElement);
    }

    let subsampleCamera = null;
    this.videoTexture = new THREE.VideoTexture(
      this.videoElement, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
      THREE.LinearFilter, THREE.NearestMipmapLinearFilter
    );
    this.videoTexture.generateMipmaps = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0,0,0);
    
    const serverRGBABuffer = new Uint8Array(rtWidth*rtHeight*4);
    const self = this;

    const animate = () => {
      if (!self.minmapRenderer || !self.videoElement) { return; }
      requestAnimationFrame(animate);

      if (self.fsQuad) {
        if (self.localConfig.showDebugBuffer) {
          self.minmapRenderer.render(self.scene, subsampleCamera);
        }

        // Render into our render target texture - this will be the data that we send to the voxel server for display
        self.minmapRenderer.setRenderTarget(self.renderTarget);
        self.minmapRenderer.render(self.scene, subsampleCamera);
        self.minmapRenderer.setRenderTarget(null);

        // Move the render target data onto the CPU and send it to the server
        self.minmapRenderer.readRenderTargetPixels(self.renderTarget, 0, 0, rtWidth, rtHeight, serverRGBABuffer);
        self.masterCP.controllerClient.sendFramebufferSliceInfo(rtWidth, rtHeight, serverRGBABuffer);
      }
    };
    animate();

    const updateVideoSize = (videoWidth, videoHeight) => {
      const minSize = Math.min(videoWidth, videoHeight);
      subsampleCamera = new THREE.OrthographicCamera(
        (videoWidth-minSize)/2, (videoWidth-minSize)/2 + minSize,
        (videoHeight-minSize)/2 + minSize, (videoHeight-minSize)/2,
        0, 1
      );

      if (self.fsQuad) { 
        self.fsQuad.material.dispose();
        self.fsQuad.geometry.dispose();
        self.scene.remove(self.fsQuad);
      }
      self.fsQuad = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(videoWidth, videoHeight, 1, 1), 
        new THREE.MeshBasicMaterial({ map: self.videoTexture })
      );
      self.fsQuad.position.set(videoWidth/2, videoHeight/2, 0);
      self.scene.add(self.fsQuad);
      console.log(`Updated video size to: ${videoWidth}x${videoHeight}`);
    };

    this.videoElement.addEventListener('resize', () => {
      const {videoWidth, videoHeight} = self.videoElement;
      updateVideoSize(videoWidth, videoHeight);
    }, true);

    document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).style.display = "inherit";
  }

  onUnloadControls() {
    super.onUnloadControls();

    if (this.scene) {
      this.scene.remove(this.fsQuad);
      this.scene = null;
    }
    if (this.fsQuad) {
      this.fsQuad.material.dispose();
      this.fsQuad.geometry.dispose();
      this.fsQuad = null;
    }
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    if (this.renderTarget) {
      this.renderTarget.dispose();
      this.renderTarget = null;
    }
    if (this.minmapRenderer) {
      if (document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).contains(this.minmapRenderer.domElement)) {
        document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).removeChild(this.minmapRenderer.domElement);
      }
      this.minmapRenderer.dispose();
      this.minmapRenderer = null;
    }

    if (this.videoElement) {
      if (document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).contains(this.videoElement)) {
        document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).removeChild(this.videoElement);
      }
      this.videoElement = null;
    }
    document.getElementById(MasterCP.FRAMEBUFFER_CONTAINER_DIV_ID).style.display = "none";
  }

}

export default VideoCP;
