
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

  onLoadControls() {
    super.onLoadControls();
  }

  onUnloadControls() {
    super.onUnloadControls();
  }
  
}

export default DepthCP;
