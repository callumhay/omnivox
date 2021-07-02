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
      Object.entries(sceneDefaultOptionsMap).forEach(entry => {
        const [currSceneType, currSceneData] = entry;
        const guiOptions = {...currSceneData.options};
        // Make sure the options have GUI-appropriate values based on their types
        for (const [key, value] of Object.entries(currSceneData.options)) {
          if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
            guiOptions[key] = colourToGui(value);
          }
        }
        sceneOptionsMap[currSceneType] = guiOptions;
      });
      this.settings = {
        sceneType: this.config.sceneType,
        ...sceneOptionsMap
      };
    }

    for (let [key, value] of Object.entries(this.config.sceneOptions)) {
      if (Array.isArray(value)) { continue; }
      if (typeof value === 'object') {
        // Is the current property a colour?
        if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
          this.settings[this.config.sceneType][key] = colourToGui(value);
          continue;
        }
      }
      // Otherwise assume it's a basic property and overwrite it
      this.settings[this.config.sceneType][key] = value;
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
      self._addSceneControls(subfolder, sceneSettings, sceneDefaultOptionsMap[sceneType].constraints);
      subfolder.hidden = true;
      folder.remove(subfolder);
      return subfolder;
    });

    const onSceneTypeChanged = ev => {
      self.config.sceneType = ev.value;

      sceneTypeSubfolders.forEach(subfolder => { subfolder.hidden = true; });
      sceneTypeSubfolders[SCENE_TYPES.indexOf(ev.value)].hidden = false;

      const sceneTypeSettings = self.settings[ev.value];
      
      // We need to be very careful here not to reassign the object of the config.sceneOptions
      // instead we need to keep the object the same and delete then reinsert new scene options
      // If we don't do this then all of the controls will not change the config properly!
      for (const key of Object.keys(self.config.sceneOptions)) {
        delete self.config.sceneOptions[key];
      }
      for (const [key,value] of Object.entries(sceneTypeSettings)) {
        self.config.sceneOptions[key] = value;
      }

      for (let [key, value] of Object.entries(sceneTypeSettings)) {
        if (Array.isArray(value)) { continue; }
        if (typeof value === 'object') {
          // Is the current property a colour?
          if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
            self.config.sceneOptions[key] = guiColorToRGBObj(value);
            continue;
          }
        }
        self.config.sceneOptions[key] = value;
      }

      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    };
    this.addList(folder, 'sceneType', SCENE_TYPES, "Scene", onSceneTypeChanged);

    // Add the subfolders back so they appear after the list widget
    for (const subfolder of sceneTypeSubfolders) { folder.add(subfolder); }

    return folder;
  }

  _addSceneControls(parentFolder, settingsObj, constraintsObj) {
    for (const settingsKey of Object.keys(settingsObj)) {
      this.addControl(parentFolder, settingsKey, 
        (settingsKey in constraintsObj) ? constraintsObj[settingsKey] : {}, settingsObj, this.config.sceneOptions
      );
    }
  }
}

export default SceneAnimCP;
