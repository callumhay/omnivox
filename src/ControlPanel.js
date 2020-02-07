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
    const startPos = this.shootingStarAnimator.config.startPosition;

    const shootingStarSettings = {...this.shootingStarAnimator.config,
      colour: THREEColorToGuiColor(this.shootingStarAnimator.config.colour),
      startPosition: {x: startPos.x, y: startPos.y, z: startPos.z},
      speed: currVel.length(),
      direction: {x: nCurrVel.x, y: nCurrVel.y, z: nCurrVel.z},
      fadeTime: this.shootingStarAnimator.config.fadeTimeSecs,
      repeat: this.shootingStarAnimator.config.repeat,
      reset: () => { 
        this.shootingStarAnimator.reset();
        this.voxelDisplay.clearRGB(0,0,0);
      },
    };

    const folder = this.gui.addFolder("Shooting Star Controls");
    folder.add(shootingStarSettings, 'repeat', -1, 10, 1).onChange((value) => {
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, repeat:value});
    });
    folder.addColor(shootingStarSettings, 'colour').onChange((value) => {
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, colour:GuiColorToTHREEColor(value)});
    });
    folder.add(shootingStarSettings, 'fadeTime', 0.1, 10.0, 0.1).onChange((value) => {
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, fadeTimeSecs: value});
    });
    folder.add(shootingStarSettings, 'speed', -10.0, 10.0, 0.5).onChange((value) => {

      const currDir = shootingStarSettings.direction;
      const currVel = new THREE.Vector3(currDir.x, currDir.y, currDir.z).multiplyScalar(shootingStarSettings.speed);

      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config,
        velocity: currVel,
      });
    });
    
    const directionFolder = folder.addFolder("Direction");
    const onDirectionChange = (value, component) => {
      const currVelNorm = shootingStarSettings.direction;
      const currSpd = shootingStarSettings.speed;
      currVelNorm[component] = value;
    
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, 
        velocity: {x: currVelNorm.x*currSpd, y: currVelNorm.y*currSpd, z: currVelNorm.z*currSpd}
      });
    }

    directionFolder.add(shootingStarSettings.direction, 'x', 0, 1, 0.1).onChange((value) => {
      onDirectionChange(value, 'x');
    });
    directionFolder.add(shootingStarSettings.direction, 'y', 0, 1, 0.1).onChange((value) => {
      onDirectionChange(value, 'y');
    });
    directionFolder.add(shootingStarSettings.direction, 'z', 0, 1, 0.1).onChange((value) => {
      onDirectionChange(value, 'z');
    });
    directionFolder.open();

    const gridSize = this.voxelDisplay.voxelGridSizeInUnits() / this.voxelDisplay.voxelSizeInUnits();
    const startPosFolder = folder.addFolder("Start Position");
    const onStartPositionChange = (value, component) => {
      const currPos = shootingStarSettings.startPosition;
      currPos[component] = value;
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, 
        startPosition: currPos
      });
    };
    startPosFolder.add(shootingStarSettings.startPosition, 'x', 0, gridSize-1, 1).onChange((value) => {
      onStartPositionChange(value, 'x');
    });
    startPosFolder.add(shootingStarSettings.startPosition, 'y', 0, gridSize-1, 1).onChange((value) => {
      onStartPositionChange(value, 'y');
    });
    startPosFolder.add(shootingStarSettings.startPosition, 'z', 0, gridSize-1, 1).onChange((value) => {
      onStartPositionChange(value, 'z');
    });
    startPosFolder.open();

    folder.add(shootingStarSettings, 'reset');
    folder.open();
  
    return folder;
  }

}

export default ControlPanel;