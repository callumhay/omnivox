import * as dat from 'dat.gui';
import * as THREE from 'three';

import VoxelColourAnimator, {COLOUR_INTERPOLATION_TYPES, INTERPOLATION_TYPES} from './Animation/VoxelColourAnimator';
import ShootingStarAnimator from './Animation/ShootingStarAnimator';
import ShootingStarShowerAnimator from './Animation/ShootingStarShowerAnimator';
import ShapeWaveAnimator, {shapeWaveAnimatorDefaultConfig, WAVE_SHAPE_TYPES} from './Animation/ShapeWaveAnimator';
import GameOfLifeAnimator, { gameOfLifeAnimatorDefaultConfig } from './Animation/GameOfLifeAnimator';

const ROUTINE_TYPE_VOXEL_COLOUR  = "Colour Change"
const ROUTINE_TYPE_SHOOTING_STAR = "Shooting Star";
const ROUTINE_TYPE_STAR_SHOWER   = "Star Shower";
const ROUTINE_SHAPE_WAVES        = "Shape Waves";
const ROUTINE_GAME_OF_LIFE       = "Game of Life";
const ROUTINE_TYPES = [
  ROUTINE_TYPE_VOXEL_COLOUR,
  ROUTINE_TYPE_SHOOTING_STAR,
  ROUTINE_TYPE_STAR_SHOWER,
  ROUTINE_SHAPE_WAVES,
  ROUTINE_GAME_OF_LIFE,
];

const VOXEL_COLOUR_SHAPE_TYPE_ALL    = "All";
const VOXEL_COLOUR_SHAPE_TYPE_SPHERE = "Sphere";
const VOXEL_COLOUR_SHAPE_TYPE_BOX    = "Box";
const VOXEL_COLOUR_SHAPE_TYPES = [
  VOXEL_COLOUR_SHAPE_TYPE_ALL,
  VOXEL_COLOUR_SHAPE_TYPE_SPHERE,
  VOXEL_COLOUR_SHAPE_TYPE_BOX,
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

    const halfVoxelDisplayUnits = (this.voxelDisplay.gridSize-1)/2;
    
    this.colourAnimator = new VoxelColourAnimator(voxelDisplay);
    this.shootingStarAnimator = new ShootingStarAnimator(voxelDisplay);
    this.starShowerAnimator = new ShootingStarShowerAnimator(voxelDisplay);
    this.shapeWaveAnimator = new ShapeWaveAnimator(voxelDisplay);
    this.gameOfLifeAnimator = new GameOfLifeAnimator(voxelDisplay);

    const velocity = this.shootingStarAnimator.config.velocity;
    const currVel = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const nCurrVel = currVel.clone().normalize();
    const startPos = this.shootingStarAnimator.config.startPosition;
    const starShowerConfig = this.starShowerAnimator.config;

    this.settings = {
      routine: ROUTINE_TYPE_VOXEL_COLOUR,
      voxelColourSettings: {...this.colourAnimator.config,
        shapeType: VOXEL_COLOUR_SHAPE_TYPE_ALL,
        sphereProperties: {center: {x:halfVoxelDisplayUnits, y:halfVoxelDisplayUnits, z:halfVoxelDisplayUnits}, radius:halfVoxelDisplayUnits, fill:false},
        boxProperties: {center: {x:halfVoxelDisplayUnits, y:halfVoxelDisplayUnits, z:halfVoxelDisplayUnits}, width:2*halfVoxelDisplayUnits-2, height:2*halfVoxelDisplayUnits-2, depth:2*halfVoxelDisplayUnits-2, fill:false},
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

      shapeWaveSettings: {
        center: {x: shapeWaveAnimatorDefaultConfig.center.x, y: shapeWaveAnimatorDefaultConfig.center.y, z: shapeWaveAnimatorDefaultConfig.center.z },
        shapeType: shapeWaveAnimatorDefaultConfig.waveShape,
        waveSpeed: shapeWaveAnimatorDefaultConfig.waveSpeed,
        waveGap: shapeWaveAnimatorDefaultConfig.waveGap,
        colourPalette: shapeWaveAnimatorDefaultConfig.colourPalette,
        reset: () => { 
          this.shapeWaveAnimator.reset();
          this.voxelDisplay.clearRGB(0,0,0);
        },
      },

      gameOfLifeSettings: {
        seed: gameOfLifeAnimatorDefaultConfig.seed,
        reset: () => { 
          this.voxelDisplay.clearRGB(0,0,0);
          this.gameOfLifeAnimator.reset();
        },
      }
    };
    
    this.currFolder = null;
    this.shapeSettingsFolder = null;
    this.currAnimator = this.colourAnimator;

    this.gui.remember(this.settings);
    
    this.gui.remember(this.settings.voxelColourSettings);
    this.gui.remember(this.settings.voxelColourSettings.sphereProperties);
    this.gui.remember(this.settings.voxelColourSettings.sphereProperties.center);
    this.gui.remember(this.settings.voxelColourSettings.boxProperties);
    this.gui.remember(this.settings.voxelColourSettings.boxProperties.center);

    this.gui.remember(this.settings.shootingStarSettings);
    this.gui.remember(this.settings.shootingStarSettings.startPosition);
    this.gui.remember(this.settings.shootingStarSettings.direction);

    this.gui.remember(this.settings.starShowerSettings);
    this.gui.remember(this.settings.starShowerSettings.minSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.maxSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.direction);

    this.gui.remember(this.settings.shapeWaveSettings);
    this.gui.remember(this.settings.shapeWaveSettings.center);

    this.gui.remember(this.settings.gameOfLifeSettings);

    this.gui.add(this.settings, 'routine', ROUTINE_TYPES).onChange((value) => {

      // Clear the display and remove any GUI elements from before
      this.voxelDisplay.clearRGB(0,0,0);
      if (this.currFolder) {
        this.gui.removeFolder(this.currFolder);
        this.currFolder = null;
        this.shapeSettingsFolder = null;
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
        case ROUTINE_SHAPE_WAVES:
          this.currFolder = this.buildShapeWavesAnimatorControls();
          this.currAnimator = this.shapeWaveAnimator;
          break;
        case ROUTINE_GAME_OF_LIFE:
          this.currFolder = this.buildGameOfLifeAnimatorControls();
          this.currAnimator = this.gameOfLifeAnimator;
          break;
        default:
          break;
      }
      this.currAnimator.reset();
    }).setValue(this.settings.routine);

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

    folder.add(voxelColourSettings, 'shapeType', VOXEL_COLOUR_SHAPE_TYPES).onChange((value) => {
      if (this.shapeSettingsFolder) {
        folder.removeFolder(this.shapeSettingsFolder);
        this.shapeSettingsFolder = null;
      }
      switch (value) {

        case VOXEL_COLOUR_SHAPE_TYPE_ALL:
          this.voxelDisplay.clearRGB(0,0,0);
          this.colourAnimator.setConfig({...this.colourAnimator.config,
            voxelPositions: this.voxelDisplay.voxelIndexList(),
          });
          break;

        case VOXEL_COLOUR_SHAPE_TYPE_SPHERE: {
          this.shapeSettingsFolder = folder.addFolder("Sphere Properties");
          this.shapeSettingsFolder.add(voxelColourSettings.sphereProperties, 'fill').onChange((value) => {
            this.voxelDisplay.clearRGB(0,0,0);
            this.colourAnimator.setConfig({...this.colourAnimator.config,
              voxelPositions: this.voxelDisplay.voxelSphereList(
                new THREE.Vector3(
                  voxelColourSettings.sphereProperties.center.x,
                  voxelColourSettings.sphereProperties.center.y,
                  voxelColourSettings.sphereProperties.center.z
                ), voxelColourSettings.sphereProperties.radius, value 
              ),
            });
          }).setValue(voxelColourSettings.sphereProperties.fill);
          this.shapeSettingsFolder.add(voxelColourSettings.sphereProperties, 'radius', 0.5, this.voxelDisplay.gridSize, 0.5).onChange((value) => {
            this.voxelDisplay.clearRGB(0,0,0);
            this.colourAnimator.setConfig({...this.colourAnimator.config,
              voxelPositions: this.voxelDisplay.voxelSphereList(
                new THREE.Vector3(
                  voxelColourSettings.sphereProperties.center.x,
                  voxelColourSettings.sphereProperties.center.y,
                  voxelColourSettings.sphereProperties.center.z
                ), value, voxelColourSettings.sphereProperties.fill
              ),
            });
          }).setValue(voxelColourSettings.sphereProperties.radius);

          const onChangeSphereCenter = (value, component) => {
            this.voxelDisplay.clearRGB(0,0,0);
            const newCenter = new THREE.Vector3(voxelColourSettings.sphereProperties.center.x,voxelColourSettings.sphereProperties.center.y,voxelColourSettings.sphereProperties.center.z);
            newCenter[component] = value;
            this.colourAnimator.setConfig({...this.colourAnimator.config,
              voxelPositions: this.voxelDisplay.voxelSphereList(newCenter, voxelColourSettings.sphereProperties.radius, voxelColourSettings.sphereProperties.fill),
            });
          };

          const centerFolder = this.shapeSettingsFolder.addFolder("Center");
          const voxelGridSize = this.voxelDisplay.gridSize;
          centerFolder.add(voxelColourSettings.sphereProperties.center, 'x', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeSphereCenter(value, 'x');
          }).setValue(voxelColourSettings.sphereProperties.center.x);
          centerFolder.add(voxelColourSettings.sphereProperties.center, 'y', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeSphereCenter(value, 'y');
          }).setValue(voxelColourSettings.sphereProperties.center.y);
          centerFolder.add(voxelColourSettings.sphereProperties.center, 'z', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeSphereCenter(value, 'z');
          }).setValue(voxelColourSettings.sphereProperties.center.z);
          centerFolder.open();

          this.shapeSettingsFolder.open();
          
          break;
        }

        case VOXEL_COLOUR_SHAPE_TYPE_BOX: {

          const buildBoxPts = (currBoxProperties) => {
            const halfWidth = currBoxProperties.width/2.0;
            const halfHeight = currBoxProperties.height/2.0;
            const halfDepth = currBoxProperties.depth/2.0;

            return this.voxelDisplay.voxelBoxList(
              new THREE.Vector3(
                currBoxProperties.center.x-halfWidth,
                currBoxProperties.center.y-halfHeight,
                currBoxProperties.center.z-halfDepth
              ), 
              new THREE.Vector3(
                currBoxProperties.center.x+halfWidth,
                currBoxProperties.center.y+halfHeight,
                currBoxProperties.center.z+halfDepth,
              ), currBoxProperties.fill 
            );
          };

          const onChangeBasicBoxProperty = (value, property) => {
            this.voxelDisplay.clearRGB(0,0,0);
            this.colourAnimator.setConfig({...this.colourAnimator.config, voxelPositions: buildBoxPts({...voxelColourSettings.boxProperties, [property]:value})});
          };
          const onChangeBoxCenter = (value, component) => {
            this.voxelDisplay.clearRGB(0,0,0);
            const newCenter = new THREE.Vector3(voxelColourSettings.boxProperties.center.x,voxelColourSettings.boxProperties.center.y,voxelColourSettings.boxProperties.center.z);
            newCenter[component] = value;
            this.colourAnimator.setConfig({...this.colourAnimator.config,
              voxelPositions: buildBoxPts({...voxelColourSettings.boxProperties, center:newCenter}),
            });
          };

          this.shapeSettingsFolder = folder.addFolder("Box Properties");
          this.shapeSettingsFolder.add(voxelColourSettings.boxProperties, 'fill').onChange((value) => {
            onChangeBasicBoxProperty(value, 'fill');
          }).setValue(voxelColourSettings.boxProperties.fill);

          const dimensionsFolder = this.shapeSettingsFolder.addFolder("Dimensions");
          const voxelGridSize = this.voxelDisplay.gridSize;
          dimensionsFolder.add(voxelColourSettings.boxProperties, 'width', 0.5, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBasicBoxProperty(value, 'width');
          }).setValue(voxelColourSettings.boxProperties.width);
          dimensionsFolder.add(voxelColourSettings.boxProperties, 'height', 0.5, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBasicBoxProperty(value, 'height');
          }).setValue(voxelColourSettings.boxProperties.height);
          dimensionsFolder.add(voxelColourSettings.boxProperties, 'depth', 0.5, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBasicBoxProperty(value, 'depth');
          }).setValue(voxelColourSettings.boxProperties.depth);
          dimensionsFolder.open();

          const centerFolder = this.shapeSettingsFolder.addFolder("Center");
          centerFolder.add(voxelColourSettings.boxProperties.center, 'x', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBoxCenter(value, 'x');
          }).setValue(voxelColourSettings.boxProperties.center.x);
          centerFolder.add(voxelColourSettings.boxProperties.center, 'y', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBoxCenter(value, 'y');
          }).setValue(voxelColourSettings.boxProperties.center.y);
          centerFolder.add(voxelColourSettings.boxProperties.center, 'z', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBoxCenter(value, 'z');
          }).setValue(voxelColourSettings.boxProperties.center.z);
          centerFolder.open();
          
          this.shapeSettingsFolder.open();
          break;
        }
        default:
          break;
      }
    }).setValue(voxelColourSettings.shapeType);

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

    const gridSize = this.voxelDisplay.gridSize;
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

    const positionMax = 2*this.voxelDisplay.gridSize;
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

  buildShapeWavesAnimatorControls() {
    const {shapeWaveSettings} = this.settings;

    const folder = this.gui.addFolder("Shape Wave Controls");

    folder.add(shapeWaveSettings, 'waveSpeed', 0.5, 25.0, 0.5).onChange((value) => {
      const currConfig = this.shapeWaveAnimator.config;
      currConfig.waveSpeed = value;
      this.shapeWaveAnimator.setConfig(currConfig);
    }).setValue(shapeWaveSettings.waveSpeed);
    folder.add(shapeWaveSettings, 'waveGap', 0.0, 25.0, 1).onChange((value) => {
      const currConfig = this.shapeWaveAnimator.config;
      currConfig.waveGap = value;
      this.shapeWaveAnimator.setConfig(currConfig);
    }).setValue(shapeWaveSettings.waveGap);


    folder.add(shapeWaveSettings, 'shapeType', WAVE_SHAPE_TYPES).onChange((value) => {
      const currConfig = this.shapeWaveAnimator.config;
      currConfig.waveShape = value;
      this.shapeWaveAnimator.setConfig(currConfig);
    }).setValue(shapeWaveSettings.shapeType);

    const onChangeWaveCenter = (value, component) => {
      const currConfig = this.shapeWaveAnimator.config;
      currConfig.center[component] = value;
      this.shapeWaveAnimator.setConfig(currConfig);
    };

    const centerFolder = folder.addFolder("Center");
    const voxelGridSize = this.voxelDisplay.gridSize;
    centerFolder.add(shapeWaveSettings.center, 'x', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'x');
    }).setValue(shapeWaveSettings.center.x);
    centerFolder.add(shapeWaveSettings.center, 'y', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'y');
    }).setValue(shapeWaveSettings.center.y);
    centerFolder.add(shapeWaveSettings.center, 'z', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'z');
    }).setValue(shapeWaveSettings.center.z);
    centerFolder.open();

    /*
    const paletteFolder = folder.addFolder("Colour Palette");
    shapeWaveSettings.colourPalette.forEach((colour, idx) => {
      paletteFolder.addColor(shapeWaveSettings.colourPalette, idx).onChange((value) => {

      }).setValue(value);
    });
    */



    folder.add(shapeWaveSettings, 'reset');
    folder.open();

    return folder;
  }

  buildGameOfLifeAnimatorControls() {
    const {gameOfLifeSettings} = this.settings;

    const folder = this.gui.addFolder("Game of Life Controls");

    folder.add(gameOfLifeSettings, 'seed').onChange((value) => {
      const currConfig = this.gameOfLifeAnimator.config;
      currConfig['seed'] = value;
      this.gameOfLifeAnimator.setConfig(currConfig);
    });


    folder.add(gameOfLifeSettings, 'reset');
    folder.open();

    return folder;
  }

}

export default ControlPanel;