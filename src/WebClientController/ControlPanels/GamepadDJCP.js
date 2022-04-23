import VoxelAnimator from '../../Animation/VoxelAnimator';
import {gamepadDJAnimatorDefaultConfig} from '../../Animation/GamepadDJAnimator';

import AnimCP from './AnimCP';

class GamepadDJCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...gamepadDJAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_GAMEPAD_DJ; }

  buildFolder() {
    //const self = this;
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Gamepad DJ Controls"});

    return folder;
  }
}

export default GamepadDJCP;