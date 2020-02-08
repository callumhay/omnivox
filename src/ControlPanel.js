import * as dat from 'dat.gui';
import * as THREE from 'three';

import VoxelColourAnimator, {COLOUR_INTERPOLATION_TYPES, INTERPOLATION_TYPES} from './Animation/VoxelColourAnimator';
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
    this.gui = new dat.GUI({preset:'Default'});
    this.voxelDisplay = voxelDisplay;

    this.colourAnimator = new VoxelColourAnimator(voxelDisplay);
    this.colourAnimator.setConfig({...this.colourAnimator.config,
      voxelPositions: voxelDisplay.voxelIndexList(),
    });
    this.shootingStarAnimator = new ShootingStarAnimator(voxelDisplay);
    this.starShowerAnimator = new ShootingStarShowerAnimator(voxelDisplay);

    const velocity = this.shootingStarAnimator.config.velocity;
    const currVel = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const nCurrVel = currVel.clone().normalize();
    const startPos = this.shootingStarAnimator.config.startPosition;
    const starShowerConfig = this.starShowerAnimator.config;

    this.settings = {
      routine: ROUTINE_TYPE_VOXEL_COLOUR,
      voxelColourSettings: {...this.colourAnimator.config,
        colourStart: THREEColorToGuiColor(this.colourAnimator.config.colourStart),
        colourEnd: THREEColorToGuiColor(this.colourAnimator.config.colourEnd),
        reset: () => { this.colourAnimator.reset(); },
      },

      shootingStarSettings: {...this.shootingStarAnimator.config,
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
      },

      starShowerSettings: {
        minSpawnPos: {x: starShowerConfig.positionRandomizer.min.x, y: starShowerConfig.positionRandomizer.min.y, z: starShowerConfig.positionRandomizer.min.z},
        maxSpawnPos: {x: starShowerConfig.positionRandomizer.max.x, y: starShowerConfig.positionRandomizer.max.y, z: starShowerConfig.positionRandomizer.max.z},
        direction: {x: starShowerConfig.directionRandomizer.baseDirection.x, y: starShowerConfig.directionRandomizer.baseDirection.y, z: starShowerConfig.directionRandomizer.baseDirection.z},
        directionVariance: starShowerConfig.directionRandomizer.radAngle, // [0, PI]
        speedMin: starShowerConfig.speedRandomizer.min,
        speedMax: starShowerConfig.speedRandomizer.max,
        spawnRate: starShowerConfig.spawnRate,
        colourMin: THREEColorToGuiColor(starShowerConfig.colourRandomizer.min), 
        colourMax: THREEColorToGuiColor(starShowerConfig.colourRandomizer.max), 
        reset: () => { 
          this.starShowerAnimator.reset();
          this.voxelDisplay.clearRGB(0,0,0);
        },
      },
    };
    

    this.currFolder = null;
    this.currAnimator = this.colourAnimator;

    this.gui.remember(this.settings);
    
    this.gui.remember(this.settings.voxelColourSettings);

    this.gui.remember(this.settings.shootingStarSettings);
    this.gui.remember(this.settings.shootingStarSettings.startPosition);
    this.gui.remember(this.settings.shootingStarSettings.direction);

    this.gui.remember(this.settings.starShowerSettings);
    this.gui.remember(this.settings.starShowerSettings.minSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.maxSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.direction);

    const routineTypesController = this.gui.add(this.settings, 'routine', ROUTINE_TYPES);
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
      this.currAnimator.reset();
    });

    routineTypesController.setValue(this.settings.routine);

    this.gui.open();
  }

  buildVoxelColourControls() {
    const {voxelColourSettings} = this.settings;
  
    const folder = this.gui.addFolder("Colour Change Controls");

    folder.add(voxelColourSettings, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, colourInterpolationType:value});
    }).setValue(voxelColourSettings.colourInterpolationType);
    
    folder.add(voxelColourSettings, 'interpolationType', INTERPOLATION_TYPES).onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, interpolationType:value});
    }).setValue(voxelColourSettings.interpolationType);

    folder.addColor(voxelColourSettings, 'colourStart').onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, colourStart:GuiColorToTHREEColor(value)});
    }).setValue(voxelColourSettings.colourStart);
    
    folder.addColor(voxelColourSettings, 'colourEnd').onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, colourEnd:GuiColorToTHREEColor(value)});
    }).setValue(voxelColourSettings.colourEnd);
    
    folder.add(voxelColourSettings, 'startTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, startTimeSecs:value});
    }).setValue(voxelColourSettings.startTimeSecs);
    
    folder.add(voxelColourSettings, 'endTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimator.setConfig({...this.colourAnimator.config, endTimeSecs:value});
    }).setValue(voxelColourSettings.endTimeSecs);
    
    folder.add(voxelColourSettings, 'reset');

    folder.open();
  
    return folder;
  }

  buildShootingStarAnimatorControls() {
    const {shootingStarSettings} = this.settings;

    const folder = this.gui.addFolder("Shooting Star Controls");
    folder.add(shootingStarSettings, 'repeat', -1, 10, 1).onChange((value) => {
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, repeat:value});
    }).setValue(shootingStarSettings.repeat);

    folder.addColor(shootingStarSettings, 'colour').onChange((value) => {
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, colour:GuiColorToTHREEColor(value)});
    }).setValue(shootingStarSettings.colour);

    folder.add(shootingStarSettings, 'fadeTime', 0.1, 10.0, 0.1).onChange((value) => {
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config, fadeTimeSecs: value});
    }).setValue(shootingStarSettings.fadeTime);

    folder.add(shootingStarSettings, 'speed', -10.0, 10.0, 0.5).onChange((value) => {
      const currDir = shootingStarSettings.direction;
      const currVel = new THREE.Vector3(currDir.x, currDir.y, currDir.z).multiplyScalar(shootingStarSettings.speed);
      this.shootingStarAnimator.setConfig({...this.shootingStarAnimator.config,
        velocity: currVel,
      });
    }).setValue(shootingStarSettings.speed);
    
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
    }).setValue(shootingStarSettings.direction.x);
    directionFolder.add(shootingStarSettings.direction, 'y', 0, 1, 0.1).onChange((value) => {
      onDirectionChange(value, 'y');
    }).setValue(shootingStarSettings.direction.y);
    directionFolder.add(shootingStarSettings.direction, 'z', 0, 1, 0.1).onChange((value) => {
      onDirectionChange(value, 'z');
    }).setValue(shootingStarSettings.direction.z);
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
    }).setValue(shootingStarSettings.startPosition.x);
    startPosFolder.add(shootingStarSettings.startPosition, 'y', 0, gridSize-1, 1).onChange((value) => {
      onStartPositionChange(value, 'y');
    }).setValue(shootingStarSettings.startPosition.y);
    startPosFolder.add(shootingStarSettings.startPosition, 'z', 0, gridSize-1, 1).onChange((value) => {
      onStartPositionChange(value, 'z');
    }).setValue(shootingStarSettings.startPosition.z);
    startPosFolder.open();

    folder.add(shootingStarSettings, 'reset');
    folder.open();
  
    return folder;
  }

  buildStarShowerAnimatorControls() {
    const {starShowerSettings} = this.settings;

    const folder = this.gui.addFolder("Star Shower Controls");
    folder.add(starShowerSettings, 'spawnRate', 0.25, 50.0, 0.25).onChange((value) => {
      this.starShowerAnimator.setConfig({...this.starShowerAnimator.config, 
        spawnRate: value
      });
    }).setValue(starShowerSettings.spawnRate);

    folder.addColor(starShowerSettings, 'colourMin').onChange((value) => {
      const currRandomizer = this.starShowerAnimator.config.colourRandomizer;
      currRandomizer.min = GuiColorToTHREEColor(value);
      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
    }).setValue(starShowerSettings.colourMin);

    folder.addColor(starShowerSettings, 'colourMax').onChange((value) => {
      const currRandomizer = this.starShowerAnimator.config.colourRandomizer;
      currRandomizer.max = GuiColorToTHREEColor(value);
      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
    }).setValue(starShowerSettings.colourMax);

    const onChangeSpd = (value, component) => {
      const currRandomizer = this.starShowerAnimator.config.speedRandomizer;
      currRandomizer[component] = value;
      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
    };
    folder.add(starShowerSettings, 'speedMin', 1, 25.0, 0.5).onChange((value) => {
      const actualVal = Math.min(value, starShowerSettings.speedMax);
      onChangeSpd(actualVal, 'min');
      starShowerSettings.speedMin = actualVal;
    }).setValue(starShowerSettings.speedMin);
    folder.add(starShowerSettings, 'speedMax', 1, 25.0, 0.5).onChange((value) => {
      const actualVal = Math.max(value, starShowerSettings.speedMin);
      onChangeSpd(actualVal, 'max');
      starShowerSettings.speedMax = actualVal;
    }).setValue(starShowerSettings.speedMax);

    folder.add(starShowerSettings, 'directionVariance', 0, Math.PI, Math.PI/16).onChange((value) => {
      const currRandomizer = this.starShowerAnimator.config.directionRandomizer;
      currRandomizer.radAngle = value;
      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
    }).setValue(starShowerSettings.directionVariance);

    const onChangeDir = (value, component) => {
      const currRandomizer = this.starShowerAnimator.config.directionRandomizer;

      currRandomizer.baseDirection = new THREE.Vector3(starShowerSettings.direction.x, starShowerSettings.direction.y, starShowerSettings.direction.z);
      currRandomizer.baseDirection[component] = value;
      currRandomizer.baseDirection.normalize();

      this.starShowerAnimator.setConfig(this.starShowerAnimator.config);
    };
    const dirFolder = folder.addFolder("Direction");
    dirFolder.add(starShowerSettings.direction, 'x', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'x');
    }).setValue(starShowerSettings.direction.x);
    dirFolder.add(starShowerSettings.direction, 'y', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'y');
    }).setValue(starShowerSettings.direction.y);
    dirFolder.add(starShowerSettings.direction, 'z', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'z');
    }).setValue(starShowerSettings.direction.z);
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
    }).setValue(starShowerSettings.minSpawnPos.x);
    minPosFolder.add(starShowerSettings.minSpawnPos, 'y', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMin(value, 'y');
    }).setValue(starShowerSettings.minSpawnPos.y);
    minPosFolder.add(starShowerSettings.minSpawnPos, 'z', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMin(value, 'z');
    }).setValue(starShowerSettings.minSpawnPos.z);
    minPosFolder.open();

    const maxPosFolder = posFolder.addFolder("Max");
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'x', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMax(value, 'x');
    }).setValue(starShowerSettings.maxSpawnPos.x);
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'y', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMax(value, 'y');
    }).setValue(starShowerSettings.maxSpawnPos.y);
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'z', -positionMax, positionMax, 1).onChange((value) => {
      onChangePositionMax(value, 'z');
    }).setValue(starShowerSettings.maxSpawnPos.z);

    maxPosFolder.open();
    posFolder.open();

    folder.add(starShowerSettings, 'reset');
    folder.open();

    return folder;
  }

}

export default ControlPanel;