import * as dat from 'dat.gui';
import * as THREE from 'three';

import VoxelColourAnimator from './Animation/VoxelColourAnimator';
import ShootingStarAnimator from './Animation/ShootingStarAnimator';
import ShootingStarShowerAnimator from './Animation/ShootingStarShowerAnimator';

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
    this.starShowerAnimator = new ShootingStarShowerAnimator(voxelDisplay);

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
          this.currFolder = this.buildStarShowerAnimatorControls();
          this.currAnimator = this.starShowerAnimator;
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

  buildStarShowerAnimatorControls() {
    const currConfig = this.starShowerAnimator.config;
    const starShowerSettings = {
      minSpawnPos: {x: currConfig.positionRandomizer.min.x, y: currConfig.positionRandomizer.min.y, z: currConfig.positionRandomizer.min.z},
      maxSpawnPos: {x: currConfig.positionRandomizer.max.x, y: currConfig.positionRandomizer.max.y, z: currConfig.positionRandomizer.max.z},
      direction: {x: currConfig.directionRandomizer.baseDirection.x, y: currConfig.directionRandomizer.baseDirection.y, z: currConfig.directionRandomizer.baseDirection.z},
      directionVariance: currConfig.directionRandomizer.radAngle, // [0, PI]
      speedMin: currConfig.speedRandomizer.min,
      speedMax: currConfig.speedRandomizer.max,
      spawnRate: currConfig.spawnRate,
      colourMin: currConfig.colourRandomizer.min, // HSL
      colourMax: currConfig.colourRandomizer.max, // HSL
      reset: () => { 
        this.starShowerAnimator.reset();
        this.voxelDisplay.clearRGB(0,0,0);
      },
    };

    const folder = this.gui.addFolder("Star Shower Controls");
    folder.add(starShowerSettings, 'spawnRate', 0.25, 50.0, 0.25).onChange((value) => {
      this.starShowerAnimator.setConfig({...this.starShowerAnimator.config, 
        spawnRate: value
      });
    });

    const onChangeDir = (value, component) => {
      const currRandomizer = this.starShowerAnimator.config.directionRandomizer;
      currRandomizer.baseDirection[component] = value;
      currRandomizer.baseDirection.normalize();
      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
      starShowerSettings.direction = {x: currRandomizer.baseDirection.x, y: currRandomizer.baseDirection.y, z: currRandomizer.baseDirection.z};
    };
    const dirFolder = folder.addFolder("Direction");
    dirFolder.add(starShowerSettings.direction, 'x', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'x');
    });
    dirFolder.add(starShowerSettings.direction, 'y', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'y');
    });
    dirFolder.add(starShowerSettings.direction, 'z', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'z');
    });
    dirFolder.open();
    
    const onChangePositionMin = (value, component) => {
      const actualVal = Math.min(value, starShowerSettings.maxSpawnPos[component]);
      const currRandomizer = this.starShowerAnimator.config.positionRandomizer;
      currRandomizer.min[component] = actualVal;
      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
      starShowerSettings.minSpawnPos[component] = actualVal;
    };
    const onChangePositionMax = (value, component) => {
      const actualVal = Math.max(value, starShowerSettings.minSpawnPos[component]);
      const currRandomizer = this.starShowerAnimator.config.positionRandomizer;
      currRandomizer.max[component] = actualVal;
      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
      starShowerSettings.maxSpawnPos[component] = actualVal;
    };
    const positionMax = 2*this.voxelDisplay.voxelGridSizeInUnits();

    const posFolder = folder.addFolder("Position Spawning");
    const minPosFolder = posFolder.addFolder("Min");
    minPosFolder.add(starShowerSettings.minSpawnPos, 'x', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMin(value, 'x');
    });
    minPosFolder.add(starShowerSettings.minSpawnPos, 'y', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMin(value, 'y');
    });
    minPosFolder.add(starShowerSettings.minSpawnPos, 'z', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMin(value, 'z');
    });
    minPosFolder.open();

    const maxPosFolder = posFolder.addFolder("Max");
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'x', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMax(value, 'x');
    });
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'y', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMax(value, 'y');
    });
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'z', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMax(value, 'z');
    });

    maxPosFolder.open();
    posFolder.open();

    folder.add(starShowerSettings, 'reset');
    folder.open();

    return folder;
  }

}

export default ControlPanel;