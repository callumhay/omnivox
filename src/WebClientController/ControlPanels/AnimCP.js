import {CHANGE_EVENT, colourToGui, guiColorToRGBObj} from "../controlpanelfuncs";

class AnimCP {
  constructor(masterCP, initialConfig) {
    this.masterCP = masterCP;
    this.config = initialConfig;
    this.loadSettings();
    this.folder = this.buildFolder();
  }

  animatorType() { console.error("animatorType() unimplemented!"); }
  buildFolder()  { console.error("buildFolder() unimplemented!");  }

  loadSettings() { 
    if (!this.settings) {
      this.settings = {...this.config};
    }
    for (let [key, value] of Object.entries(this.config)) {
      if (Array.isArray(value)) { continue; }
      if (typeof value === 'object') {
        // Is the current property a colour?
        if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
          this.settings[key] = colourToGui(value);
          continue;
        }
      }

      // Otherwise assume it's a basic property and overwrite it
      this.settings[key] = value;
    }
  }

  updateConfig(newConfig) {
    this.config = newConfig;
    this.loadSettings();
  }

  addControl(parentFolder, controlParam, options, settingsObj=null, configObj=null) {
    const self = this;
    const settingsInUse = settingsObj || self.settings;
    

    if (!settingsInUse || settingsInUse[controlParam] === undefined) {
      console.error("Control parameter '" + controlParam + "' not present in settings.");
      return null;
    }

    // Determine the type of control...
    const control = settingsInUse[controlParam];
    if (Array.isArray(control)) {
      console.error("Array type found while creating control... this is unimplemented!");
      return null;
    }
    else if (typeof control === 'object') {
      if (control.r !== undefined && control.g !== undefined && control.b !== undefined) {
        // Colour
        return parentFolder.addInput(settingsInUse, controlParam, options).on(CHANGE_EVENT, ev => {
          const configInUse = configObj || self.config;
          configInUse[controlParam] = guiColorToRGBObj(ev.value);
          self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), configInUse);
        });
      }
      else if (control.x !== undefined || control.y !== undefined || control.z !== undefined) {
        // Point or vector just fall through (Tweakpane will handle it with addInput)
      }
      else {
        // Special kind of object, this will require its own subfolder (e.g., attenuation)
        const configInUse = configObj || self.config;
        const title = 'label' in options ? options.label : controlParam.charAt(0).toUpperCase() + controlParam.slice(1);
        const subfolder = parentFolder.addFolder({title: title});
        for (const key of Object.keys(settingsInUse[controlParam])) {
          this.addControl(subfolder, key, (key in options) ? options[key] : {}, settingsInUse[controlParam], configInUse[controlParam]);
        }
        return subfolder;
      }
    }

    const configInUse = configObj || self.config;
    return parentFolder.addInput(settingsInUse, controlParam, options).on(CHANGE_EVENT, ev => {
      configInUse[controlParam] = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
  }

  addList(parentFolder, controlParam, listOptions, label, onChange=null, initialValue=null) {
    const self = this;
    const blade = parentFolder.addBlade({
      view: 'list',
      label: label,
      options: listOptions.map(a => ({text: a, value: a})),
      value: '',
    }).on(CHANGE_EVENT, onChange || (ev => {
      self.config[controlParam] = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    }));

    if (initialValue !== null) { blade.value = initialValue; }
    else { blade.value = this.settings[controlParam]; }
    
    return blade;
  }
}

export default AnimCP;