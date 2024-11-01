import * as dat from 'dat.gui';
import * as THREE from 'three';

import VoxelConstants from '../src/VoxelConstants';
import VoxelAnimator, {DEFAULT_CROSSFADE_TIME_SECS} from '../src/Animation/VoxelAnimator';
import {voxelColourAnimatorDefaultConfig, INTERPOLATION_TYPES} from '../src/Animation/VoxelColourAnimator';
import {starShowerDefaultConfig} from '../src/Animation/StarShowerAnimator';
import {shapeWaveAnimatorDefaultConfig, WAVE_SHAPE_TYPES} from '../src/Animation/ShapeWaveAnimator';
import FireAnimator, {fireAnimatorDefaultConfig} from '../src/Animation/FireAnimator';
import {sceneDefaultOptionsMap, sceneAnimatorDefaultConfig, SCENE_TYPES} from '../src/Animation/SceneAnimatorDefaultConfigs';
import BarVisualizerAnimator, {barVisualizerAnimatorDefaultConfig} from '../src/Animation/BarVisualizerAnimator';
import { textAnimatorDefaultConfig } from '../src/Animation/TextAnimator';

import {ColourSystems, COLOUR_INTERPOLATION_TYPES} from '../src/Spectrum';
import VoxelGeometryUtils from '../src/VoxelGeometryUtils';
import {threeColorToGuiColor, guiColorToRGBObj, buildGuiControls} from './ControlPanelBuilder';

const VOXEL_COLOUR_SHAPE_TYPE_ALL    = "All";
const VOXEL_COLOUR_SHAPE_TYPE_SPHERE = "Sphere";
const VOXEL_COLOUR_SHAPE_TYPE_BOX    = "Box";
const VOXEL_COLOUR_SHAPE_TYPES = [
  VOXEL_COLOUR_SHAPE_TYPE_ALL,
  VOXEL_COLOUR_SHAPE_TYPE_SPHERE,
  VOXEL_COLOUR_SHAPE_TYPE_BOX,
];

class ControlPanel {
  constructor(voxelClient, voxelDisplay, soundController) {
    
    this.gui = new dat.GUI({preset:'Default'});
    this.voxelClient  = voxelClient;
    this.voxelDisplay = voxelDisplay;

    this.soundController = soundController;

    this.colourAnimatorConfig = {...voxelColourAnimatorDefaultConfig};
    this.textAnimatorConfig = {...textAnimatorDefaultConfig};
    this.starShowerAnimatorConfig = {...starShowerDefaultConfig};
    this.shapeWaveAnimatorConfig = {...shapeWaveAnimatorDefaultConfig};
    this.fireAnimatorConfig = {...fireAnimatorDefaultConfig};
    this.sceneAnimatorConfig = {...sceneAnimatorDefaultConfig};
    this.sceneAnimatorConfig.sceneOptions = {...sceneAnimatorDefaultConfig.sceneOptions};
    this.barVisAnimatorConfig = {...barVisualizerAnimatorDefaultConfig};
    
    this.settings = {};
    this.reloadSettings();
    
    this.currFolder = null;
    this.shapeSettingsFolder = null;
    this.sceneSettingsFolder = null;
    this.fireColourModeFolder = null;
    this.fireAudioVisFolder = null;
    this.barVisDisplayTypeFolder = null;
    this.barVisColourModeFolder = null;

    this.animatorTypeController = this.gui.add(this.settings, 'animatorType', [
      VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR,
      VoxelAnimator.VOXEL_ANIM_TEXT,
      VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER,
      VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES,
      VoxelAnimator.VOXEL_ANIM_FIRE,
      VoxelAnimator.VOXEL_ANIM_SCENE,
      VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER,
    ]).onChange((value) => {

      // Clear the display and remove any GUI elements from before
      if (this.currFolder) {
        this.gui.removeFolder(this.currFolder);
        this.currFolder = null;
        this.shapeSettingsFolder = null;
        this.sceneSettingsFolder = null;
        this.fireColourModeFolder = null;
        this.fireAudioVisFolder = null;
        this.barVisDisplayTypeFolder = null;
        this.barVisColourModeFolder = null;
      }

      this.soundController.enabled = false;
      switch (value) {
        case VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR:
          this.currFolder = this.buildVoxelColourControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
          break;
        
        case VoxelAnimator.VOXEL_ANIM_TEXT:
          this.currFolder = this.buildTextAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TEXT, this.textAnimatorConfig);
          break;

        case VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER:
          this.currFolder = this.buildStarShowerAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
          break;

        case VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES:
          this.currFolder = this.buildShapeWavesAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
          break;

        case VoxelAnimator.VOXEL_ANIM_FIRE:
          this.currFolder = this.buildFireAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          this.soundController.enabled = true;
          break;
        
        case VoxelAnimator.VOXEL_ANIM_SCENE:
          this.currFolder = this.buildSceneAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          break;
        
        case VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER:
          this.currFolder = this.buildBarVisAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          this.soundController.enabled = true;
          break;

        default:
          console.error("Animator type Not implemented!");
          break;
      }

      if (this.visualizerDebugController) {
        this.gui.remove(this.visualizerDebugController);
        this.visualizerDebugController = null;
      }
      if (this.soundController.enabled) {
        this.visualizerDebugController = this.gui.add(this.settings, 'showVisualizerDebug').onChange((value) => {
          this.soundController.showDebug = value;
        }).setValue(this.settings.showVisualizerDebug);
      }

      voxelClient.sendClearCommand(0,0,0);
    }).setValue(this.settings.animatorType);

    this.gui.add(this.settings, 'showWireFrame').onChange((value) => {
      this.voxelDisplay.setOutlinesEnabled(value);
    }).setValue(this.settings.showWireFrame);
    this.gui.add(this.settings, 'orbitMode').onChange((value) => {
      this.voxelDisplay.setOrbitModeEnabled(value);
    }).setValue(this.settings.orbitMode);
    this.gui.add(this.settings, 'crossfadeTime', 0, 10, 0.1).onChange((value) => {
      this.voxelClient.sendCrossfadeTime(value);
    }).setValue(this.settings.crossfadeTime);
    this.gui.add(this.settings, 'brightness', 0, 1, 0.01).onChange((value) => {
      this.voxelClient.sendGlobalBrightness(value);
    }).setValue(this.settings.brightness);

    this.gui.open();
  }

  resetDisplay() {
    this.voxelClient.sendRoutineResetCommand();
    this.voxelClient.sendClearCommand(0, 0, 0);
  }

  reloadVoxelColourSettings() {
    const halfVoxelDisplayUnits = (this.voxelClient.voxelDisplay.gridSize - 1) / 2;
    this.settings.voxelColourSettings = {...this.colourAnimatorConfig,
      shapeType: VOXEL_COLOUR_SHAPE_TYPE_ALL,
      sphereProperties: { center: { x: halfVoxelDisplayUnits, y: halfVoxelDisplayUnits, z: halfVoxelDisplayUnits }, radius: halfVoxelDisplayUnits, fill: false },
      boxProperties: { center: { x: halfVoxelDisplayUnits, y: halfVoxelDisplayUnits, z: halfVoxelDisplayUnits }, rotation: { x: 0, y: 0, z: 0}, width: 2 * halfVoxelDisplayUnits - 2, height: 2 * halfVoxelDisplayUnits - 2, depth: 2 * halfVoxelDisplayUnits - 2, fill: false },
      colourStart: threeColorToGuiColor(this.colourAnimatorConfig.colourStart),
      colourEnd: threeColorToGuiColor(this.colourAnimatorConfig.colourEnd),
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.voxelColourSettings);
    this.gui.remember(this.settings.voxelColourSettings.sphereProperties);
    this.gui.remember(this.settings.voxelColourSettings.sphereProperties.center);
    this.gui.remember(this.settings.voxelColourSettings.boxProperties);
    this.gui.remember(this.settings.voxelColourSettings.boxProperties.center);
    this.gui.remember(this.settings.voxelColourSettings.boxProperties.rotation);
  }
  reloadTextSettings() {
    this.settings.textSettings = {...this.textAnimatorConfig,
      colour: threeColorToGuiColor(this.textAnimatorConfig.colour),
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.textSettings);
  }
  reloadStarShowerSettings() {
    this.settings.starShowerSettings = {...this.starShowerAnimatorConfig,
      colourMin: threeColorToGuiColor(this.starShowerAnimatorConfig.colourMin),
      colourMax: threeColorToGuiColor(this.starShowerAnimatorConfig.colourMax),
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.starShowerSettings);
    this.gui.remember(this.settings.starShowerSettings.minSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.maxSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.direction);
  }
  reloadShapeWavesSettings() {
    this.settings.shapeWaveSettings = {
      center: { x: this.shapeWaveAnimatorConfig.center.x, y: this.shapeWaveAnimatorConfig.center.y, z: this.shapeWaveAnimatorConfig.center.z },
      shapeType: this.shapeWaveAnimatorConfig.waveShape,
      waveSpeed: this.shapeWaveAnimatorConfig.waveSpeed,
      waveGap: this.shapeWaveAnimatorConfig.waveGap,
      colourPalette: this.shapeWaveAnimatorConfig.colourPalette,
      brightness: this.shapeWaveAnimatorConfig.brightness,
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.shapeWaveSettings);
    this.gui.remember(this.settings.shapeWaveSettings.center);
  }
  reloadFireSettings() {
    this.settings.fireSettings = {...this.fireAnimatorConfig,
      lowTempColour: threeColorToGuiColor(this.fireAnimatorConfig.lowTempColour),
      highTempColour: threeColorToGuiColor(this.fireAnimatorConfig.highTempColour),
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.fireSettings);
  }
  reloadSceneSettings() {
    const sceneOptionsMap = {};
    Object.values(sceneDefaultOptionsMap).forEach(mapVal => {
      const guiOptions = {...mapVal.options};

      // Make sure the options have GUI-appropriate values based on their types
      for (const [key, value] of Object.entries(mapVal.options)) {
        if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
          guiOptions[key] = threeColorToGuiColor(value);
        }
      }

      sceneOptionsMap[mapVal.name] = guiOptions;
    });

    this.settings.sceneSettings = {
      sceneType: this.sceneAnimatorConfig.sceneType,
      ...sceneOptionsMap
    };

    this.gui.remember(this.settings.sceneSettings);
    this.gui.remember(this.settings.sceneSettings.sceneType);
  }
  reloadBarVisSettings() {
    this.settings.barVisSettings = {...this.barVisAnimatorConfig,
      lowColour: threeColorToGuiColor(barVisualizerAnimatorDefaultConfig.lowColour),
      highColour: threeColorToGuiColor(barVisualizerAnimatorDefaultConfig.highColour),
    };
    this.gui.remember(this.settings.barVisSettings);
  }

  reloadSettings() {
    this.settings = {...this.settings,
      animatorType: VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR,
      showWireFrame: this.voxelDisplay.outlinesEnabled,
      orbitMode: this.voxelDisplay.orbitModeEnabled,
      crossfadeTime: DEFAULT_CROSSFADE_TIME_SECS,
      brightness: VoxelConstants.DEFAULT_BRIGHTNESS_MULTIPLIER,
      showVisualizerDebug: this.soundController.showDebug,
    };

    this.reloadVoxelColourSettings();
    this.reloadTextSettings();
    this.reloadStarShowerSettings();
    this.reloadShapeWavesSettings();
    this.reloadFireSettings();
    this.reloadSceneSettings();
    this.reloadBarVisSettings();

    this.gui.remember(this.settings);
  }

  updateBrightness(brightness) {
    this.settings.brightness = brightness;
    this.gui.remember(this.settings);
  } 

  updateAnimator(animatorType, config) {
    
    switch (animatorType) {

      case VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR:
        this.colourAnimatorConfig = config;
        this.reloadVoxelColourSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_TEXT:
        this.textAnimatorConfig = config;
        this.reloadTextSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER:
        this.starShowerAnimatorConfig = config;
        this.reloadStarShowerSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES:
        this.shapeWaveAnimatorConfig = config;
        this.reloadShapeWavesSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_FIRE:
        this.fireAnimatorConfig = config;
        this.reloadFireSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_SCENE:
        this.sceneAnimatorConfig = config;
        this.reloadSceneSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER:
        this.barVisAnimatorConfig = config;
        this.reloadBarVisSettings();
        break;
      
      default:
        console.error("Animator type Not implemented!");
        break;
    }
    this.animatorTypeController.setValue(animatorType);
  }

  buildVoxelColourControls() {
    const {voxelColourSettings} = this.settings;
  
    const folder = this.gui.addFolder("Colour Change Controls");
   
    folder.add(voxelColourSettings, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
      this.colourAnimatorConfig.colourInterpolationType = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.colourInterpolationType);
    
    folder.add(voxelColourSettings, 'interpolationType', INTERPOLATION_TYPES).onChange((value) => {
      this.colourAnimatorConfig.interpolationType = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.interpolationType);

    folder.addColor(voxelColourSettings, 'colourStart').onChange((value) => {
      this.colourAnimatorConfig.colourStart = guiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.colourStart);
    
    folder.addColor(voxelColourSettings, 'colourEnd').onChange((value) => {
      this.colourAnimatorConfig.colourEnd = guiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.colourEnd);
    
    folder.add(voxelColourSettings, 'startTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimatorConfig.startTimeSecs = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.startTimeSecs);
    
    folder.add(voxelColourSettings, 'endTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimatorConfig.endTimeSecs = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.endTimeSecs);
    
    folder.add(voxelColourSettings, 'reset');

    const {voxelDisplay} = this.voxelClient;
    folder.add(voxelColourSettings, 'shapeType', VOXEL_COLOUR_SHAPE_TYPES).onChange((value) => {

      if (this.shapeSettingsFolder) {
        folder.removeFolder(this.shapeSettingsFolder);
        this.shapeSettingsFolder = null;
      }

      switch (value) {
        case VOXEL_COLOUR_SHAPE_TYPE_ALL:
          this.colourAnimatorConfig.voxelPositions = voxelDisplay.voxelIndexList();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
          this.voxelClient.sendClearCommand(0,0,0);
          break;

        case VOXEL_COLOUR_SHAPE_TYPE_SPHERE: {
          this.shapeSettingsFolder = folder.addFolder("Sphere Properties");

          this.shapeSettingsFolder.add(voxelColourSettings.sphereProperties, 'fill').onChange((value) => {
            const {radius} = voxelColourSettings.sphereProperties;
            const center = new THREE.Vector3(
              voxelColourSettings.sphereProperties.center.x,
              voxelColourSettings.sphereProperties.center.y,
              voxelColourSettings.sphereProperties.center.z
            );
            const voxelBB = VoxelGeometryUtils.voxelBoundingBox(voxelDisplay.gridSize);
            this.colourAnimatorConfig.voxelPositions = VoxelGeometryUtils.voxelSphereList(center, radius, value, voxelBB);

            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);

          }).setValue(voxelColourSettings.sphereProperties.fill);

          this.shapeSettingsFolder.add(voxelColourSettings.sphereProperties, 'radius', 0.5, voxelDisplay.gridSize, 0.5).onChange((value) => {
            
            const center = new THREE.Vector3(
              voxelColourSettings.sphereProperties.center.x,
              voxelColourSettings.sphereProperties.center.y,
              voxelColourSettings.sphereProperties.center.z
            );
            const {fill} = voxelColourSettings.sphereProperties;
            const voxelBB = VoxelGeometryUtils.voxelBoundingBox(voxelDisplay.gridSize);
            this.colourAnimatorConfig.voxelPositions = VoxelGeometryUtils.voxelSphereList(center, value, fill, voxelBB);

            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);

          }).setValue(voxelColourSettings.sphereProperties.radius);

          const onChangeSphereCenter = (value, component) => {
            const newCenter = new THREE.Vector3(voxelColourSettings.sphereProperties.center.x,voxelColourSettings.sphereProperties.center.y,voxelColourSettings.sphereProperties.center.z);
            newCenter[component] = value;
            const {radius, fill} = voxelColourSettings.sphereProperties;
            const voxelBB = VoxelGeometryUtils.voxelBoundingBox(voxelDisplay.gridSize);
            this.colourAnimatorConfig.voxelPositions = VoxelGeometryUtils.voxelSphereList(newCenter, radius, fill, voxelBB);
            
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);
          };

          const centerFolder = this.shapeSettingsFolder.addFolder("Center");
          const voxelGridSize = voxelDisplay.gridSize;
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
            const {width, height, depth, center, rotation, fill} = currBoxProperties;

            const centerVec3 = new THREE.Vector3(center.x, center.y, center.z);
            const eulerRot = new THREE.Euler(
              THREE.MathUtils.degToRad(rotation.x), 
              THREE.MathUtils.degToRad(rotation.y),
              THREE.MathUtils.degToRad(rotation.z), 'XYZ'
            );
            const size = new THREE.Vector3(width, height, depth);
            return VoxelGeometryUtils.voxelBoxList(centerVec3, eulerRot, size, fill, VoxelGeometryUtils.voxelBoundingBox(voxelDisplay.gridSize));
          };

          const onChangeBasicBoxProperty = (value, property) => {
            this.colourAnimatorConfig.voxelPositions = buildBoxPts({...voxelColourSettings.boxProperties, [property]:value});
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);
          };
          const onChangeBoxCenter = (value, component) => {
            const {center} = voxelColourSettings.boxProperties;
            const newCenter = new THREE.Vector3(center.x, center.y, center.z);
            newCenter[component] = value;
            this.colourAnimatorConfig.voxelPositions = buildBoxPts({...voxelColourSettings.boxProperties, center:newCenter});
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);
          };
          const onChangeBoxRotation = (value, component) => {
            const {rotation} = voxelColourSettings.boxProperties;
            const newRot = {...rotation};
            newRot[component] = value;
            this.colourAnimatorConfig.voxelPositions = buildBoxPts({...voxelColourSettings.boxProperties, rotation:newRot});
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);
          };

          this.shapeSettingsFolder = folder.addFolder("Box Properties");
          this.shapeSettingsFolder.add(voxelColourSettings.boxProperties, 'fill').onChange((value) => {
            onChangeBasicBoxProperty(value, 'fill');
          }).setValue(voxelColourSettings.boxProperties.fill);

          const dimensionsFolder = this.shapeSettingsFolder.addFolder("Dimensions");
          const voxelGridSize = voxelDisplay.gridSize;
          ['width', 'height', 'depth'].forEach(dim => {
            dimensionsFolder.add(voxelColourSettings.boxProperties, dim, 0.5, 2*voxelGridSize, 0.5).onChange((value) => {
              onChangeBasicBoxProperty(value, dim);
            }).setValue(voxelColourSettings.boxProperties[dim]);
          });
          dimensionsFolder.open();

          const centerFolder = this.shapeSettingsFolder.addFolder("Center");
          const rotationFolder = this.shapeSettingsFolder.addFolder("Rotation");
          const minRot = -360; const maxRot = 360;
          ['x', 'y', 'z'].forEach(component => {
            centerFolder.add(voxelColourSettings.boxProperties.center, component, -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
              onChangeBoxCenter(value, component);
            }).setValue(voxelColourSettings.boxProperties.center[component]);
            rotationFolder.add(voxelColourSettings.boxProperties.rotation, component, minRot, maxRot, 1.0).onChange((value) => {
              onChangeBoxRotation(value, component);
            }).setValue(voxelColourSettings.boxProperties.rotation[component]);
          });
          centerFolder.open();
          rotationFolder.open();

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

  buildTextAnimatorControls() {
    const {textSettings} = this.settings;

    const folder = this.gui.addFolder("Font/Text Controls");

    folder.add(textSettings, 'text').onChange((value) => {
      this.textAnimatorConfig.text = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TEXT, this.textAnimatorConfig);
    }).setValue(textSettings.text);

    folder.add(textSettings, 'letterSpacing').onChange((value) => {
      this.textAnimatorConfig.letterSpacing = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TEXT, this.textAnimatorConfig);
    }).setValue(textSettings.letterSpacing);

    folder.addColor(textSettings, 'colour').onChange((value) => {
      this.textAnimatorConfig.colour = guiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TEXT, this.textAnimatorConfig);
    }).setValue(textSettings.colour);

    folder.open();
    return folder;
  }

  buildStarShowerAnimatorControls() {
    const {starShowerSettings} = this.settings;

    const folder = this.gui.addFolder("Star Shower Controls");
    folder.add(starShowerSettings, 'spawnRate', 1, 100, 1).onChange((value) => {
      this.starShowerAnimatorConfig.spawnRate = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      //this.voxelClient.sendClearCommand(0,0,0);
    }).setValue(starShowerSettings.spawnRate);

    folder.addColor(starShowerSettings, 'colourMin').onChange((value) => {
      this.starShowerAnimatorConfig.colourMin =  guiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      //this.voxelClient.sendClearCommand(0,0,0);
    }).setValue(starShowerSettings.colourMin);

    folder.addColor(starShowerSettings, 'colourMax').onChange((value) => {
      this.starShowerAnimatorConfig.colourMax = guiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      //this.voxelClient.sendClearCommand(0,0,0);
    }).setValue(starShowerSettings.colourMax);

    const onChangeSpd = (value, component) => {
      const currRandomizer = this.starShowerAnimatorConfig.speedRandomizer;
      currRandomizer[component] = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);

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
      const currRandomizer = this.starShowerAnimatorConfig.directionRandomizer;
      currRandomizer.radAngle = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
    }).setValue(starShowerSettings.directionVariance);

    const onChangeDir = (value, component) => {
      const currRandomizer = this.starShowerAnimatorConfig.directionRandomizer;
      currRandomizer.baseDirection = new THREE.Vector3(starShowerSettings.direction.x, starShowerSettings.direction.y, starShowerSettings.direction.z);
      currRandomizer.baseDirection[component] = value;
      currRandomizer.baseDirection.normalize();
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
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
      const currRandomizer = this.starShowerAnimatorConfig.positionRandomizer;
      currRandomizer.min[component] = actualVal;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      starShowerSettings.minSpawnPos[component] = actualVal;
    };
    const onChangePositionMax = (value, component) => {
      const actualVal = Math.max(value, starShowerSettings.minSpawnPos[component]);
      const currRandomizer = this.starShowerAnimatorConfig.positionRandomizer;
      currRandomizer.max[component] = actualVal;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      starShowerSettings.maxSpawnPos[component] = actualVal;
    };

    const positionXMax = 2*this.voxelClient.voxelDisplay.xSize();
    const positionYMax = 2*this.voxelClient.voxelDisplay.ySize();
    const positionZMax = 2*this.voxelClient.voxelDisplay.zSize();

    const posFolder = folder.addFolder("Position Spawning");
    const minPosFolder = posFolder.addFolder("Min");
    minPosFolder.add(starShowerSettings.minSpawnPos, 'x', -positionXMax, positionXMax, 1).onChange((value) => {
      onChangePositionMin(value, 'x');
    }).setValue(starShowerSettings.minSpawnPos.x);
    minPosFolder.add(starShowerSettings.minSpawnPos, 'y', -positionYMax, positionYMax, 1).onChange((value) => {
      onChangePositionMin(value, 'y');
    }).setValue(starShowerSettings.minSpawnPos.y);
    minPosFolder.add(starShowerSettings.minSpawnPos, 'z', -positionZMax, positionZMax, 1).onChange((value) => {
      onChangePositionMin(value, 'z');
    }).setValue(starShowerSettings.minSpawnPos.z);
    minPosFolder.open();

    const maxPosFolder = posFolder.addFolder("Max");
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'x', -positionXMax, positionXMax, 1).onChange((value) => {
      onChangePositionMax(value, 'x');
    }).setValue(starShowerSettings.maxSpawnPos.x);
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'y', -positionYMax, positionYMax, 1).onChange((value) => {
      onChangePositionMax(value, 'y');
    }).setValue(starShowerSettings.maxSpawnPos.y);
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'z', -positionZMax, positionZMax, 1).onChange((value) => {
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
      this.shapeWaveAnimatorConfig.waveSpeed = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.waveSpeed);

    folder.add(shapeWaveSettings, 'waveGap', 0.0, 25.0, 1).onChange((value) => {
      this.shapeWaveAnimatorConfig.waveGap = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.waveGap);

    folder.add(shapeWaveSettings, 'brightness', 0, 1, 1/256).onChange((value) => {
      this.shapeWaveAnimatorConfig.brightness = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.brightness);


    folder.add(shapeWaveSettings, 'shapeType', WAVE_SHAPE_TYPES).onChange((value) => {
      this.shapeWaveAnimatorConfig.waveShape = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.shapeType);

    const onChangeWaveCenter = (value, component) => {
      this.shapeWaveAnimatorConfig.center[component] = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    };

    const centerFolder = folder.addFolder("Center");

    const voxelGridSizeX = this.voxelClient.voxelDisplay.xSize();
    const voxelGridSizeY = this.voxelClient.voxelDisplay.ySize();
    const voxelGridSizeZ = this.voxelClient.voxelDisplay.zSize();

    centerFolder.add(shapeWaveSettings.center, 'x', -voxelGridSizeX, 2*voxelGridSizeX, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'x');
    }).setValue(shapeWaveSettings.center.x);
    centerFolder.add(shapeWaveSettings.center, 'y', -voxelGridSizeY, 2*voxelGridSizeY, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'y');
    }).setValue(shapeWaveSettings.center.y);
    centerFolder.add(shapeWaveSettings.center, 'z', -voxelGridSizeZ, 2*voxelGridSizeZ, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'z');
    }).setValue(shapeWaveSettings.center.z);
    centerFolder.open();

    folder.add(shapeWaveSettings, 'reset');
    folder.open();

    return folder;
  }

  buildFireAnimatorControls() {
    const {fireSettings} = this.settings;
    const folder = this.gui.addFolder("Fire Controls");

    folder.add(fireSettings, 'speed', 0.1, 5.0, 0.1).onChange((value) => {
      this.fireAnimatorConfig.speed = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.speed);

    folder.add(fireSettings, 'buoyancy', 0.1, 10, 0.1).onChange((value) => {
      this.fireAnimatorConfig.buoyancy = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.buoyancy);

    folder.add(fireSettings, 'cooling', 0.1, 1.5, 0.01).onChange((value) => {
      this.fireAnimatorConfig.cooling = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.cooling);

    folder.add(fireSettings, 'vorticityConfinement', 1, 20, 1).onChange((value) => {
      this.fireAnimatorConfig.vorticityConfinement = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.vorticityConfinement);

    folder.add(fireSettings, 'initialIntensityMultiplier', 0.1, 10, 0.1).onChange((value) => {
      this.fireAnimatorConfig.initialIntensityMultiplier = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.initialIntensityMultiplier);

    const voxelGridSizeX = this.voxelClient.voxelDisplay.xSize();
    const voxelGridSizeY = this.voxelClient.voxelDisplay.ySize();
    const voxelGridSizeZ = this.voxelClient.voxelDisplay.zSize();
    folder.add(fireSettings, 'wallPosX', -1, voxelGridSizeX/2, 1).onChange((value) => {
      this.fireAnimatorConfig.wallPosX = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.wallPosX);
    folder.add(fireSettings, 'wallNegX', -1, voxelGridSizeX/2, 1).onChange((value) => {
      this.fireAnimatorConfig.wallNegX = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.wallNegX);
    folder.add(fireSettings, 'wallPosY', -1, voxelGridSizeY-1, 1).onChange((value) => {
      this.fireAnimatorConfig.wallPosY = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.wallPosY);
    folder.add(fireSettings, 'wallPosZ', -1, voxelGridSizeZ/2, 1).onChange((value) => {
      this.fireAnimatorConfig.wallPosZ = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.wallPosZ);
    folder.add(fireSettings, 'wallNegZ', -1, voxelGridSizeZ/2, 1).onChange((value) => {
      this.fireAnimatorConfig.wallNegZ = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.wallNegZ);


    folder.add(fireSettings, 'colourMode', FireAnimator.COLOUR_MODES).onChange((value) => {
      if (this.fireColourModeFolder) {
        folder.removeFolder(this.fireColourModeFolder);
        this.fireColourModeFolder = null;
      }

      this.fireColourModeFolder = folder.addFolder(value + " Settings");
      this.fireAnimatorConfig.colourMode = value;

      switch (value) {
        default:
        case FireAnimator.TEMPERATURE_COLOUR_MODE:
          this.fireColourModeFolder.add(fireSettings, 'spectrumTempMin', 0, 10000, 100).onChange((value) => {
            this.fireAnimatorConfig.spectrumTempMin = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          }).setValue(fireSettings.spectrumTempMin);
      
          this.fireColourModeFolder.add(fireSettings, 'spectrumTempMax', 0, 10000, 100).onChange((value) => {
            this.fireAnimatorConfig.spectrumTempMax = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          }).setValue(fireSettings.spectrumTempMax);
      
          this.fireColourModeFolder.add(fireSettings, 'colourSystem', Object.keys(ColourSystems)).onChange((value) => {
            this.fireAnimatorConfig.colourSystem = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          }).setValue(fireSettings.colourSystem);
          break;

        case FireAnimator.LOW_HIGH_TEMP_COLOUR_MODE:
          this.fireColourModeFolder.addColor(fireSettings, 'lowTempColour').onChange((value) => {
            this.fireAnimatorConfig.lowTempColour = guiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          }).setValue(fireSettings.lowTempColour);
          this.fireColourModeFolder.addColor(fireSettings, 'highTempColour').onChange((value) => {
            this.fireAnimatorConfig.highTempColour = guiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          }).setValue(fireSettings.highTempColour);
          this.fireColourModeFolder.add(fireSettings, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
            this.fireAnimatorConfig.colourInterpolationType = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          }).setValue(fireSettings.colourInterpolationType);
          break;
  
        case FireAnimator.RANDOM_COLOUR_MODE:
          this.buildBasicRandomColourControls(this.fireColourModeFolder, fireSettings, VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          this.fireColourModeFolder.add(fireSettings, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
            this.fireAnimatorConfig.colourInterpolationType = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          }).setValue(fireSettings.colourInterpolationType);
          break;
      }

      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
      this.fireColourModeFolder.open();
    }).setValue(fireSettings.colourMode);

    // Audio visualization for the fire animator
    folder.add(fireSettings, 'audioVisualizationOn').onChange((value) => {
      this.fireAnimatorConfig.audioVisualizationOn = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.audioVisualizationOn);

    if (this.fireAudioVisFolder) {
      folder.removeFolder(this.fireAudioVisFolder);
      this.fireAudioVisFolder = null;
    }
    this.fireAudioVisFolder = folder.addFolder('Audio Visualization');

    this.buildBasicSoundVisControls(this.fireAudioVisFolder, fireSettings, VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig, false);

    this.fireAudioVisFolder.add(fireSettings, 'audioNoiseAddition', 0, 1, 0.01).onChange((value) => {
      this.fireAnimatorConfig.audioNoiseAddition = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.audioNoiseAddition);

    this.fireAudioVisFolder.add(fireSettings, 'audioSpeedMultiplier', 0.1, 3, 0.01).onChange((value) => {
      this.fireAnimatorConfig.audioSpeedMultiplier = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.audioSpeedMultiplier);

    this.fireAudioVisFolder.add(fireSettings, 'audioCoolingMultiplier', 0, 5, 0.1).onChange((value) => {
      this.fireAnimatorConfig.audioCoolingMultiplier = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.audioCoolingMultiplier);

    this.fireAudioVisFolder.add(fireSettings, 'audioBuoyancyMultiplier', 0, 5, 0.1).onChange((value) => {
      this.fireAnimatorConfig.audioBuoyancyMultiplier = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.audioBuoyancyMultiplier);

    this.fireAudioVisFolder.add(fireSettings, 'audioTurbulenceMultiplier', 0, 5, 0.1).onChange((value) => {
      this.fireAnimatorConfig.audioTurbulenceMultiplier = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.audioTurbulenceMultiplier);

    this.fireAudioVisFolder.open();

    folder.add(fireSettings, 'reset');
    folder.open();

    return folder;
  }
  
  buildSceneAnimatorControls() {
    const {sceneSettings} = this.settings;
    const folder = this.gui.addFolder("Scene Controls");
    folder.add(sceneSettings, 'sceneType', SCENE_TYPES).onChange((value) => {
      
      if (this.sceneSettingsFolder) {
        folder.removeFolder(this.sceneSettingsFolder);
        this.sceneSettingsFolder = null;
      }

      this.sceneSettingsFolder = folder.addFolder(value + " Settings");
      this.sceneAnimatorConfig.sceneType = value;
      const sceneTypeOptions = sceneSettings[sceneDefaultOptionsMap[value].name];
      this.sceneAnimatorConfig.sceneOptions = {...sceneTypeOptions};

      buildGuiControls(this.voxelClient, VoxelAnimator.VOXEL_ANIM_SCENE, 
        this.sceneSettingsFolder, this.sceneAnimatorConfig, this.sceneAnimatorConfig.sceneOptions, 
        sceneTypeOptions, sceneDefaultOptionsMap[value].controlParams);

      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
      
      this.sceneSettingsFolder.open();
    }).setValue(sceneSettings.sceneType);

    folder.open();
    return folder;
  }

  buildBasicRandomColourControls(folder, settings, animatorType, config) {
    folder.add(settings, 'randomColourHoldTime', 0.1, 60, 0.1).onChange((value) => {
      config.randomColourHoldTime = value;
      this.voxelClient.sendAnimatorChangeCommand(animatorType, config);
    }).setValue(settings.randomColourHoldTime);
    folder.add(settings, 'randomColourTransitionTime', 0.1, 60, 0.1).onChange((value) => {
      config.randomColourTransitionTime = value;
      this.voxelClient.sendAnimatorChangeCommand(animatorType, config);
    }).setValue(settings.randomColourTransitionTime);
  }

  buildBasicSoundVisControls(folder, settings, animatorType, config, hasFadeFactor=true) {
    folder.add(settings, 'levelMax', 0.1, 10, 0.01).onChange((value) => {
      config.levelMax = value;
      this.voxelClient.sendAnimatorChangeCommand(animatorType, config);
    }).setValue(settings.levelMax);

    folder.add(settings, 'gamma', 1, 8, 0.1).onChange((value) => {
      config.gamma = value;
      this.voxelClient.sendAnimatorChangeCommand(animatorType, config);
    }).setValue(settings.gamma);

    if (hasFadeFactor) {
      folder.add(settings, 'fadeFactor', 0, 0.1, 0.001).onChange((value) => {
        config.fadeFactor = value;
        this.voxelClient.sendAnimatorChangeCommand(animatorType, config);
      }).setValue(settings.fadeFactor);
    }
  }

  buildBarVisAnimatorControls() {
    const {barVisSettings} = this.settings;
    const folder = this.gui.addFolder("Bar Visualizer Controls");

    this.buildBasicSoundVisControls(folder, barVisSettings, VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);

    folder.add(barVisSettings, 'displayMode', BarVisualizerAnimator.DISPLAY_MODE_TYPES).onChange((value) => {

      if (this.barVisDisplayTypeFolder) {
        folder.removeFolder(this.barVisDisplayTypeFolder);
        this.barVisDisplayTypeFolder = null;
      }
      this.barVisDisplayTypeFolder = folder.addFolder(value + " Settings");
      this.barVisAnimatorConfig.displayMode = value;
      switch (value) {
        case BarVisualizerAnimator.MOVING_HISTORY_BARS_DISPLAY_TYPE:
          this.barVisDisplayTypeFolder.add(barVisSettings, 'speed', 1, 20, 0.1).onChange((value) => {
            this.barVisAnimatorConfig.speed = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          }).setValue(barVisSettings.speed);
          this.barVisDisplayTypeFolder.add(barVisSettings, 'tempoMultiplier', 1, 100, 1).onChange((value) => {
            this.barVisAnimatorConfig.tempoMultiplier = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          }).setValue(barVisSettings.tempoMultiplier);
          this.barVisDisplayTypeFolder.add(barVisSettings, 'direction', BarVisualizerAnimator.DIRECTION_TYPES).onChange((value) => {
            this.barVisAnimatorConfig.direction = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          }).setValue(barVisSettings.direction);

          break;

        case BarVisualizerAnimator.STATIC_BARS_DISPLAY_TYPE:
        default:
          this.barVisDisplayTypeFolder.add(barVisSettings, 'splitLevels').onChange((value) => {
            this.barVisAnimatorConfig.splitLevels = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          }).setValue(barVisSettings.splitLevels);
          this.barVisDisplayTypeFolder.add(barVisSettings, 'centerSorted').onChange((value) => {
            this.barVisAnimatorConfig.centerSorted = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          }).setValue(barVisSettings.centerSorted);
          break;
      }

      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
      this.barVisDisplayTypeFolder.open();
    }).setValue(barVisSettings.displayMode);

    folder.add(barVisSettings, 'colourMode', BarVisualizerAnimator.COLOUR_MODES).onChange((value) => {
      if (this.barVisColourModeFolder) {
        folder.removeFolder(this.barVisColourModeFolder);
        this.barVisColourModeFolder = null;
      }

      this.barVisColourModeFolder = folder.addFolder(value + " Settings");
      this.barVisAnimatorConfig.colourMode = value;

      switch (value) {
        case BarVisualizerAnimator.RANDOM_COLOUR_MODE:
          this.buildBasicRandomColourControls(this.barVisColourModeFolder, barVisSettings, VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          break;

        case BarVisualizerAnimator.LOW_HIGH_COLOUR_MODE:
        default:
          this.barVisColourModeFolder.addColor(barVisSettings, 'lowColour').onChange((value) => {
            this.barVisAnimatorConfig.lowColour = guiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          }).setValue(barVisSettings.lowColour);
          this.barVisColourModeFolder.addColor(barVisSettings, 'highColour').onChange((value) => {
            this.barVisAnimatorConfig.highColour = guiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
          }).setValue(barVisSettings.highColour);
          break;
      }

      this.barVisColourModeFolder.add(barVisSettings, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
        this.barVisAnimatorConfig.colourInterpolationType = value;
        this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
      }).setValue(barVisSettings.colourInterpolationType);

      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER, this.barVisAnimatorConfig);
      this.barVisColourModeFolder.open();
    }).setValue(barVisSettings.colourMode);

    folder.open();
    return folder;
  }
}

export default ControlPanel;