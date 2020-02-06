import * as dat from 'dat.gui';
import * as THREE from 'three';

import VoxelColourAnimator from './Animation/VoxelColourAnimator';

const ROUTINE_TYPE_VOXEL_COLOUR  = "Colour Change"
const ROUTINE_TYPE_SHOOTING_STAR = "Shooting Star";
const ROUTINE_TYPE_STAR_SHOWER   = "Star Shower";
const ROUTINE_TYPES = [
  ROUTINE_TYPE_VOXEL_COLOUR,
  ROUTINE_TYPE_SHOOTING_STAR,
  ROUTINE_TYPE_STAR_SHOWER,
];

const THREEColorToGuiColor = (c) => {
  return [parseInt(c.r*255), parseInt(c.g*255), parseInt(c.b*255)];
}
const GuiColorToTHREEColor = (c) => {
  return new THREE.Color(c[0]/255.0, c[1]/255.0, c[2]/255.0);
}

class ControlPanel {
  constructor(voxelDisplay) {
    this.gui = new dat.GUI();

    this.colourAnimator = new VoxelColourAnimator(voxelDisplay);
    this.colourAnimator.setConfig({...this.colourAnimator.config,
      voxelPositions: voxelDisplay.voxelIndexList(),
    });

    this.settings = {
      routineTypes: '',
    };

    this.currFolder = null;
    this.currAnimator = this.colourAnimator;

    this.setupControlPanel();
  }

  setupControlPanel() {

    const routineTypesController = this.gui.add(this.settings, 'routineTypes', ROUTINE_TYPES);
    routineTypesController.onChange((value) => {
      if (this.currFolder) {
        this.gui.removeFolder(this.currFolder);
      }
      switch (value) {
        case ROUTINE_TYPE_VOXEL_COLOUR:
          this.currFolder = this.buildVoxelColourControls();
          this.currAnimator = this.colourAnimator;
          break;
        case ROUTINE_TYPE_SHOOTING_STAR:
          break;
        case ROUTINE_TYPE_STAR_SHOWER:
          break;
        default:
          break;
      }
    });
    routineTypesController.setValue(ROUTINE_TYPE_VOXEL_COLOUR);

  
    this.gui.open();
  }

  

  buildVoxelColourControls() {
    const voxelColourSettings = {...this.colourAnimator.config,
      colourStart: THREEColorToGuiColor(this.colourAnimator.config.colourStart),
      colourEnd: THREEColorToGuiColor(this.colourAnimator.config.colourEnd),
      reset: () => { this.colourAnimator.reset(); },
    };
  
    const folder = this.gui.addFolder("Colour Change Controls");
    folder.addColor(voxelColourSettings, 'colourStart').onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, colourStart:GuiColorToTHREEColor(value)});
    });
    folder.addColor(voxelColourSettings, 'colourEnd').onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, colourEnd:GuiColorToTHREEColor(value)});
    });
    folder.add(voxelColourSettings, 'startTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, startTimeSecs:value});
    });
    folder.add(voxelColourSettings, 'endTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, endTimeSecs:value});
    });
    folder.add(voxelColourSettings, 'reset');
    folder.open();
  
    return folder;
  }

}

export default ControlPanel;