import * as dat from 'dat.gui';
import * as THREE from 'three';

import VoxelColourAnimator from './Animation/VoxelColourAnimator';
import ShootingStarAnimator from './Animation/ShootingStarAnimator';

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
    this.voxelDisplay = voxelDisplay;

    this.colourAnimator = new VoxelColourAnimator(voxelDisplay);
    this.colourAnimator.setConfig({...this.colourAnimator.config,
      voxelPositions: voxelDisplay.voxelIndexList(),
    });

    this.shootingStarAnimator = new ShootingStarAnimator(voxelDisplay);

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

      // Clear the display and remove any GUI elements from before
      this.voxelDisplay.clearRGB(0,0,0);
      if (this.currFolder) {
        this.gui.removeFolder(this.currFolder);
      }

      switch (value) {
        case ROUTINE_TYPE_VOXEL_COLOUR:
          this.currFolder = this.buildVoxelColourControls();
          this.currAnimator = this.colourAnimator;
          break;
        case ROUTINE_TYPE_SHOOTING_STAR:
          this.currFolder = this.buildShootingStarAnimatorControls();
          this.currAnimator = this.shootingStarAnimator;
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

  buildShootingStarAnimatorControls() {
    const velocity = this.shootingStarAnimator.config.velocity;
    const currVel = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const nCurrVel = currVel.clone().normalize();

    const shootingStarSettings = {...this.shootingStarAnimator.config,
      colour: THREEColorToGuiColor(this.shootingStarAnimator.config.colour),
      speed: currVel.length(),
      direction: {x: nCurrVel.x, y: nCurrVel.y, z: nCurrVel.z},
      //startPosition: {x:0, y:0, z:0}, velocity: {x:1, y:0, z:0},
      reset: () => { this.shootingStarAnimator.reset(); },
    };

    const folder = this.gui.addFolder("Shooting Star Controls");
    folder.addColor(shootingStarSettings, 'colour').onChange((value) => {
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, colour:GuiColorToTHREEColor(value)});
    });
    
    const directionFolder = folder.addFolder("Direction");
    directionFolder.add(shootingStarSettings.direction, 'x', -1, 1, 0.1).onChange((value) => {
    });
    directionFolder.add(shootingStarSettings.direction, 'y', -1, 1, 0.1).onChange((value) => {
    });
    directionFolder.add(shootingStarSettings.direction, 'z', -1, 1, 0.1).onChange((value) => {
    });
    directionFolder.open();

    folder.add(shootingStarSettings, 'reset');
    folder.open();
  
    return folder;
  }

}

export default ControlPanel;