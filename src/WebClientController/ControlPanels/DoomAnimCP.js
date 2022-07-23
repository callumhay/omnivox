require('emulators');
require('emulators-ui');
import * as THREE from 'three';

import VoxelAnimator from '../../Animation/VoxelAnimator';
import { doomAnimatorDefaultConfig } from '../../Animation/DoomAnimator';

import { CHANGE_EVENT } from '../controlpanelfuncs';

import AnimCP from './AnimCP';

const DOS_DIV_ELEMENT_ID = "dosContainer";
const DOS_WIDTH = 320;
const DOS_HEIGHT = 200;
const DOOM_VIEWPORT_HEIGHT = 168;
const DOS_NUM_PIXELS = DOS_WIDTH*DOS_HEIGHT;


class DoomAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...doomAnimatorDefaultConfig});
    emulators.pathPrefix = './dos/';

    // Rendering stuff
    this.rgbaBuffer = null;
    this.texture = null;
    this.scene = null;
    this.renderer = null;
    this.debugRenderer = null;
    this.fsQuad = null;
    this.renderTarget = null;
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_DOOM; }

  buildFolder() {
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Doom Options"});
    const self = this;

    if (!this.localConfig) {
      this.localConfig = {
        showDebugBuffer: false,
      };
    }

    this.addControl(folder, 'movingFramebuffer', {label: "Show Moving Framebuffer?"});
    this.addControl(folder, 'fps', {label: "Moving Slices Per Second", min:1, max:60, step:1});

    folder.addInput(this.localConfig, 'showDebugBuffer', {label: "Show Debug Buffer?"}).on(CHANGE_EVENT, ev => {
      if (!self.debugRenderer) { return; }
      if (document.getElementById(DOS_DIV_ELEMENT_ID).contains(self.debugRenderer.domElement)) {
        document.getElementById(DOS_DIV_ELEMENT_ID).removeChild(self.debugRenderer.domElement);
      }
      if (ev.value) { document.getElementById(DOS_DIV_ELEMENT_ID).appendChild(self.debugRenderer.domElement); }
    });

    return folder;
  }

  onLoadControls() {
    super.onLoadControls();

    this.rgbaBuffer = new Uint8Array(DOS_NUM_PIXELS * 4);
    // Every 4th value (alpha channel) is always 255, set it now and don't worry about it later
    for (let i = 0; i < DOS_NUM_PIXELS; i++) {
      this.rgbaBuffer[i*4 + 3] = 255;
    }

    this.texture = new THREE.DataTexture(
      this.rgbaBuffer, DOS_WIDTH, DOS_HEIGHT, THREE.RGBAFormat, undefined, undefined, 
      undefined, undefined, THREE.LinearFilter
    );
    // Flip the texture vertically
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.repeat.y = - 1;

    const rtWidth = this.masterCP.gridSize;
    const rtHeight = rtWidth;
    this.renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0,0,0);

    const playCamera = new THREE.OrthographicCamera(0,DOS_WIDTH,DOS_HEIGHT,0,0,1);
    const subsampleCamera = new THREE.OrthographicCamera(
      (DOS_WIDTH-DOOM_VIEWPORT_HEIGHT)/2, 
      (DOS_WIDTH-DOOM_VIEWPORT_HEIGHT)/2 + DOOM_VIEWPORT_HEIGHT,
      DOOM_VIEWPORT_HEIGHT, 0,
      0, 1
    );

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(DOS_WIDTH*2, DOS_HEIGHT*2);
    this.renderer.domElement.style.margin = "auto";

    this.debugRenderer = new THREE.WebGLRenderer();
    this.debugRenderer.setSize(rtWidth, rtHeight);
    this.debugRenderer.domElement.style.margin = "20px auto";

    document.getElementById(DOS_DIV_ELEMENT_ID).appendChild(this.renderer.domElement);
    if (this.localConfig.showDebugBuffer) {
      document.getElementById(DOS_DIV_ELEMENT_ID).appendChild(self.debugRenderer.domElement);
    }

    this.fsQuad = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(DOS_WIDTH,DOS_HEIGHT,1,1), 
      new THREE.MeshBasicMaterial({ map: this.texture })
    );
    this.scene.add(this.fsQuad);

    const self = this;
    let shouldUpdateTexture = false;
    const serverRGBABuffer = new Uint8Array(rtWidth*rtHeight*4);

    const animate = () => {
      if (!self.renderer || !self.scene) { return; }

      requestAnimationFrame(animate);
      if (shouldUpdateTexture) {
        self.texture.needsUpdate = true;
        self.fsQuad.position.set(DOS_WIDTH/2, DOS_HEIGHT/2, 0);
        self.renderer.render(self.scene, playCamera);

        self.texture.needsUpdate = true;
        self.fsQuad.position.set(DOS_WIDTH/2, DOS_HEIGHT/2 - (DOS_HEIGHT-DOOM_VIEWPORT_HEIGHT), 0);
        if (self.localConfig.showDebugBuffer) {
          self.debugRenderer.render(self.scene, subsampleCamera);
        }
        // Render into our render target texture - this will be the data that we send to the voxel server for display
        self.debugRenderer.setRenderTarget(self.renderTarget);
        self.debugRenderer.render(self.scene, subsampleCamera);
        self.debugRenderer.setRenderTarget(null);

        // Move the render target data onto the CPU and send it to the server
        self.debugRenderer.readRenderTargetPixels(self.renderTarget, 0, 0, rtWidth, rtHeight, serverRGBABuffer);
        self.masterCP.controllerClient.sendFramebufferSliceInfo(rtWidth, rtHeight, serverRGBABuffer);

        shouldUpdateTexture = false;
      }
    };
    animate();

    const runDoom = async () => {
      // NOTE: You'll need this bundle in order to run doom, it isn't packed with the repo,
      // it will need to be downloaded and placed in the dist/dos directory
      const bundle = await emulatorsUi.network.resolveBundle("./dos/doom.jsdos");
      const ci = await emulators.dosWorker(bundle);
      emulatorsUi.sound.audioNode(ci);

      const currKeyDowns = {};
      const keyDownEventFunc = (e) => {
        const keyCode = emulatorsUi.controls.domToKeyCode(e.keyCode);
        ci.sendKeyEvent(keyCode, true);
        currKeyDowns[keyCode] = true;
      };
      const keyUpEventFunc = (e) => {
        const keyCode = emulatorsUi.controls.domToKeyCode(e.keyCode);
        ci.sendKeyEvent(keyCode, false);
        delete currKeyDowns[keyCode];
      };
      const loseFocusEventFunc = (e) => {
        // Avoid having "stuck" keys when the window changes focus - keep track
        // of all the downkeys in a map and un-stick + remove them from the map
        const keyCodes = Object.keys(currKeyDowns);
        for (const keyCode in keyCodes) {
          ci.sendKeyEvent(keyCode, false);
          delete currKeyDowns[keyCode];
        }
      }

      window.addEventListener("keydown", keyDownEventFunc);
      window.addEventListener("keyup", keyUpEventFunc);
      window.addEventListener("visibilitychange", loseFocusEventFunc);

      ci.events().onFrame(async (rgb) => {

        if (self.rgbaBuffer === null || self.texture === null) {
          window.removeEventListener("keydown", keyDownEventFunc);
          window.removeEventListener("keyup", keyUpEventFunc);
          window.removeEventListener("visibilitychange", loseFocusEventFunc);
          await ci.exit();
          return;
        }

        for (let i = 0; i < DOS_NUM_PIXELS; i++) {
          const strideRGBA = i*4, strideRGB = i*3;
          self.rgbaBuffer[strideRGBA + 0] = rgb[strideRGB + 0];
          self.rgbaBuffer[strideRGBA + 1] = rgb[strideRGB + 1];
          self.rgbaBuffer[strideRGBA + 2] = rgb[strideRGB + 2];
          //self.rgbaBuffer[strideRGBA + 3] = 255; // This is already established when the buffer is created
        }
        shouldUpdateTexture = true;
      });
    };

    runDoom();
  }

  onUnloadControls() {
    super.onUnloadControls();
    if (!this.renderer) { return; }

    if (document.getElementById(DOS_DIV_ELEMENT_ID).contains(this.renderer.domElement)) {
      document.getElementById(DOS_DIV_ELEMENT_ID).removeChild(this.renderer.domElement);
    }
    if (document.getElementById(DOS_DIV_ELEMENT_ID).contains(this.debugRenderer.domElement)) {
      document.getElementById(DOS_DIV_ELEMENT_ID).removeChild(this.debugRenderer.domElement);
    }

    this.scene.remove(this.fsQuad); this.scene = null;
    if (this.fsQuad) {
      this.fsQuad.material.dispose();
      this.fsQuad.geometry.dispose();
      this.fsQuad = null;
    }
    this.texture.dispose(); this.texture = null;
    this.rgbaBuffer = null;
    this.renderer.dispose(); this.renderer = null;
    this.renderTarget.dispose(); this.renderTarget = null;
    this.debugRenderer.dispose(); this.debugRenderer = null;
  }

}

export default DoomAnimCP;
