import {blockVisualizerAnimatorDefaultConfig} from "../../Animation/BlockVisualizerAnimator";
import VoxelAnimator from "../../Animation/VoxelAnimator";

import AnimCP from './AnimCP';

class BlockVisualizerAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...blockVisualizerAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_BLOCK_VISUALIZER; }

  buildFolder() {
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Block Visualizer Controls"});

    this.addList(folder, 'blockSize', ["dynamic","2","4","8"], "Block Size");
    this.addControl(folder, 'shuffleBlocks', {label: "Shuffle Blocks?"});
    this.addControl(folder, 'dynamicBlockSizeTransitionTimeSecs', {label: "Dynamic Block Size Transition Time (s)", min:0.1, max:5, step:0.1});
    this.addControl(folder, 'blurIntensitySpeed', {label: "Blur Intensity Speed", min:1, max:100, step:0.1});
    this.addControl(folder, 'brightenIntensity', {label: "Lighten Intensity", min:0.1, max:3, step:0.1});

    // Audio visualization parameters
    const audioFolder = folder.addFolder({title: "Audio Parameters"});
    this.addControl(audioFolder, 'levelMax', {label: "Max Level", min: 0.1, max: 5, step: 0.01});
    this.addControl(audioFolder, 'gamma', {label: "Gamma", min: 1, max: 5, step: 0.1});
    this.addControl(audioFolder, 'fadeFactor', {label: "Fade Factor", min: 0, max: 1, step: 0.001}); 

    return folder;
  }
}

export default BlockVisualizerAnimCP;
