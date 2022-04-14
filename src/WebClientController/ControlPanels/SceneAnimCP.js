import VoxelAnimator from "../../Animation/VoxelAnimator";
import {sceneAnimatorDefaultConfig, sceneDefaultOptionsMap, SCENE_TYPES} from "../../Animation/SceneAnimatorDefaultConfigs";

import {colourToGui, guiColorToRGBObj} from "../controlpanelfuncs";

import AnimCP from "./AnimCP";

class SceneAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...sceneAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_SCENE; }

  loadSettings() {
    if (!this.settings) {
      const sceneOptionsMap = {};

      const initGuiOptions = (optionsObj, guiOptionObj) => {
        for (const [key, value] of Object.entries(optionsObj)) {
          if (typeof value === 'object') {
            if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
              guiOptionObj[key] = colourToGui(value);
            }
            else {
              initGuiOptions(optionsObj[key], guiOptionObj[key]);
            }
          }
        }
      };

      for (const [currSceneType, currSceneData] of Object.entries(sceneDefaultOptionsMap)) {
        const guiOptions = {...currSceneData.options};
        // Make sure the options have GUI-appropriate values based on their types
        initGuiOptions(currSceneData.options, guiOptions);
        sceneOptionsMap[currSceneType] = guiOptions;
      }
      this.settings = {
        sceneType: this.config.sceneType,
        ...sceneOptionsMap
      };
    }

    const initSettings = (sceneOptionsObj, settingsObj) => {
      for (let [key, value] of Object.entries(sceneOptionsObj)) {
        if (Array.isArray(value)) {}
        else if (typeof value === 'object') {
          // Is the current property a colour?
          if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
            settingsObj[key] = colourToGui(value);
          }
          else {
            // If not a colour then go down into the object
            initSettings(sceneOptionsObj[key], settingsObj[key]);
          }
        }
        else {
          // Otherwise assume it's a basic property and overwrite it
          settingsObj[key] = value;
        }
      }
    };


    initSettings(this.config.sceneOptions, this.settings[this.config.sceneType]);

    this.configSceneOptionCache = {};
    this.configSceneOptionCache[this.config.sceneType] = this.config.sceneOptions;

    // Build the rest of the config scene option cache
    for (const sceneType of SCENE_TYPES) {
      if (sceneType === this.config.sceneType) { continue; }
      this._buildOrUpdateSceneOptionsFromSettings(sceneType);
    }
  }

  buildFolder() {
    const self = this;
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Scene Controls"});

    // Build each scene type's subfolder
    const sceneTypeSubfolders = SCENE_TYPES.map(sceneType => {
      const subfolder = folder.addFolder({title: sceneType + " Settings"});
      const sceneSettings = self.settings[sceneType];
      const sceneOptions  = self.configSceneOptionCache[sceneType];
      self._addSceneControls(subfolder, sceneSettings, sceneOptions, sceneDefaultOptionsMap[sceneType].constraints);
      subfolder.hidden = true;
      folder.remove(subfolder);
      return subfolder;
    });

    const onSceneTypeChanged = ev => {
      const sceneType = ev.value;
      self.config.sceneType = sceneType;

      sceneTypeSubfolders.forEach(subfolder => { subfolder.hidden = true; });
      sceneTypeSubfolders[SCENE_TYPES.indexOf(ev.value)].hidden = false;

      for (const [key,value] of Object.entries(this.settings[sceneType])) {
        self.config.sceneOptions[key] = value;
      }

      self._buildOrUpdateSceneOptionsFromSettings(sceneType);
      self.config.sceneOptions = this.configSceneOptionCache[sceneType];

      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    };
    this.addList(folder, 'sceneType', SCENE_TYPES, "Scene", onSceneTypeChanged);

    // Add the subfolders back so they appear after the list widget
    for (const subfolder of sceneTypeSubfolders) { folder.add(subfolder); }

    return folder;
  }

  _buildOrUpdateSceneOptionsFromSettings(sceneType) {
    
    const updateSceneOptions = (sceneSettingsObj, sceneOptionsObj) => {
      for (let [key, value] of Object.entries(sceneSettingsObj)) {
        if (Array.isArray(value)) {}
        else if (typeof value === 'object') {
          // Is the current property a colour?
          if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
            sceneOptionsObj[key] = guiColorToRGBObj(value);
          }
          else {
            if (!(key in sceneOptionsObj)) { sceneOptionsObj[key] = {}; }
            updateSceneOptions(sceneSettingsObj[key], sceneOptionsObj[key]);
          }
        }
        else {
          // Otherwise assume it's a basic property and overwrite it
          sceneOptionsObj[key] = value;
        }
      }
    };

    const sceneOptions = (sceneType in this.configSceneOptionCache) ? this.configSceneOptionCache[sceneType] : {};
    const sceneTypeSettings = this.settings[sceneType];
    updateSceneOptions(sceneTypeSettings, sceneOptions);
    this.configSceneOptionCache[sceneType] = sceneOptions;
  }

  _addSceneControls(parentFolder, settingsObj, optionsObj, constraintsObj) {
    for (const settingsKey of Object.keys(settingsObj)) {
      this.addControl(parentFolder, settingsKey, 
        (settingsKey in constraintsObj) ? constraintsObj[settingsKey] : {}, settingsObj, optionsObj
      );
    }
  }
}

export default SceneAnimCP;
