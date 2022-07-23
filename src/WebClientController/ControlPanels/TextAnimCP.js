import VoxelAnimator from '../../Animation/VoxelAnimator';
import {textAnimatorDefaultConfig} from '../../Animation/TextAnimator';
import AnimCP from './AnimCP';

class TextAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...textAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_TEXT; }

  buildFolder() {
    const folder = this.masterCP.pane.addFolder({ title: "Text Controls"});
    this.addControl(folder, 'text', {label: "Display Text"});
    this.addControl(folder, 'letterSpacing',{label: "Letter Spacing", min:0, max:8, step:1});
    this.addControl(folder, 'colour', {label: "Colour"});
    return folder;
  }
}

export default TextAnimCP;
