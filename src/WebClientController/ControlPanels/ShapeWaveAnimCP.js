import VoxelAnimator from '../../Animation/VoxelAnimator';
import {shapeWaveAnimatorDefaultConfig, WAVE_SHAPE_TYPES, COLOUR_SELECTION_TYPES} from '../../Animation/ShapeWaveAnimator';

import {COLOUR_PALETTE_TYPES} from '../../Spectrum';

import AnimCP from './AnimCP';

class ShapeWaveAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...shapeWaveAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES; }

  buildFolder() {
    const {pane, gridSize} = this.masterCP;
    const folder = pane.addFolder({ title: "Shape Wave Controls"});

    this.addControl(folder, 'waveSpeed', {label: "Wave Speed", min: 0.5, max: 25, step: 0.5});
    this.addControl(folder, 'waveGap', {label: "Wave Gap", min: 0, max: 25, step: 1});
    this.addList(folder, 'waveShape', WAVE_SHAPE_TYPES, "Wave Shape");
    this.addList(folder, "colourPaletteName", COLOUR_PALETTE_TYPES, "Color Palette");
    this.addList(folder, "colourSelectionMode", COLOUR_SELECTION_TYPES, "Color Ordering");
    
    const ccConstraints = {min: -gridSize, max: 2*gridSize, step: 0.5};
    this.addControl(folder, 'center', {label: "Center", x: {...ccConstraints}, y: {...ccConstraints}, z: {...ccConstraints}});
    
    this.masterCP.buildResetButton(folder);
    return folder;
  }

}

export default ShapeWaveAnimCP;
