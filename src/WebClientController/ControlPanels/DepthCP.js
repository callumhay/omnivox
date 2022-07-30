
import VoxelAnimator from "../../Animation/VoxelAnimator";

import AnimCP from "./AnimCP";

class DepthCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {});
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
    const depthStream = await DepthCP._loadDepthCameraStream();
    if (!depthStream) { console.warn("Failed to load depth camera stream."); return; }
  }

  onUnloadControls() {
    super.onUnloadControls();
  }
  
  static async _loadDepthCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("Your browser doesn't support the required mediaDevices APIs.");
      return null;
    }

    // Enumerate the devices - try to find a RealSense (depth) camera
    let foundDeviceId = null;
    const devices = await navigator.mediaDevices.enumerateDevices();
    for (const device of devices) {
      if (device.label.indexOf("RealSense") !== -1) {
        foundDeviceId = device.deviceId;
      }
    }
    if (!foundDeviceId) {
      console.warn("No RealSense camera connected.");
      return null;
    }

    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: foundDeviceId }
    });

    /*
    const constraints = {
      audio: false,
      video: {
        width: {ideal: 1280},
        frameRate: {ideal: 90},
      }
    };
    let stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (!stream) {
      console.warn("Could not find depth camera with the following constraints:");
      console.warn(constraints);
      return null;
    }
    const track = stream.getVideoTracks()[0];
    if (track.label.indexOf("RealSense") === -1) {
      console.warn("No RealSense camera connected.");
    }
    return stream;
    */
  }

}

export default DepthCP;
