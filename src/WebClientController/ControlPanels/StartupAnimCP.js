

import VoxelAnimator from '../../Animation/VoxelAnimator';
import AnimCP from './AnimCP';

class StartupAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_GAMEPAD_DJ; }

  buildFolder() {
    //const self = this;
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Startup Controls"});
    this.masterCP.buildResetButton(folder);
    return folder;
  }
}

export default StartupAnimCP;