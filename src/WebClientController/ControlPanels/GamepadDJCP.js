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

    this.addControl(folder, 'sphereBurstThresholdMultiplier', {label: 'Sphere Burst Threshold Multiplier', min:0, max:2, step:0.01});
    this.addControl(folder, 'cursorMinAtten', {label: "Cursor Min Attenuation", min:0.001, max:1, step:0.001});
    this.addControl(folder, 'cursorMaxAtten', {label: "Cursor Max Attenuation", min:1, max:3, step:0.01});

    const audioFolder = folder.addFolder({title: "Audio Parameters"});
    this.addControl(audioFolder, 'rmsLevelMax', {label: "Max Level (RMS)", min: 0.01, max: 1, step: 0.01});

    return folder;
  }
}

export default GamepadDJCP;