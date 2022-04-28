

import VoxelAnimator from '../../Animation/VoxelAnimator';
import {startupAnimatorDefaultConfig} from '../../Animation/StartupAnimator';

import AnimCP from './AnimCP';

class StartupAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...startupAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STARTUP; }

  buildFolder() {
    //const self = this;
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Startup Controls"});
    this.addControl(folder, 'waitForSlaveConnections', {label: "Wait for Slave Connections?"});
    this.masterCP.buildResetButton(folder);
    return folder;
  }
}

export default StartupAnimCP;