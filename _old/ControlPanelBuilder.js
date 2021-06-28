export const threeColorToGuiColor = (c) => {
  return [parseInt(c.r*255),parseInt(c.g*255),parseInt(c.b*255)];
};

export const guiColorToRGBObj = (c) => {
  return {
    r: parseFloat(c[0])/255.0, 
    g: parseFloat(c[1])/255.0, 
    b: parseFloat(c[2])/255.0
  };
};

export const buildGuiControls = (voxelClient, animatorType, folder, configObj, configOptionsObj, optionsObj, controlParams) => {
  for (const [key, value] of Object.entries(optionsObj)) {
    // Is this a colour control?
    if ((Array.isArray(value) && value.length === 3) || (value.r !== undefined && value.g !== undefined && value.b !== undefined)) {
      folder.addColor(optionsObj, key).onChange((value) => {
        configOptionsObj[key] = guiColorToRGBObj(value);
        voxelClient.sendAnimatorChangeCommand(animatorType, configObj);
      }).setValue(optionsObj[key]);
    }
    else if (typeof value === 'boolean') {
      folder.add(optionsObj, key).onChange(value => {
        configOptionsObj[key] = value;
        voxelClient.sendAnimatorChangeCommand(animatorType, configObj);
      }).setValue(optionsObj[key]);
    }
    else if (typeof value === 'object') {
      // This is likely a vector of some sort, create a subfolder and populate it with the proper GUI widgets, recursively
      const subFolder = folder.addFolder(key);
      buildGuiControls(voxelClient, animatorType, subFolder, configObj, configOptionsObj[key], optionsObj[key], controlParams[key]);
    }
    else if (controlParams && key in controlParams) {
      // Basic control type - should have a min, max, and step. Add it directly to the GUI
      const {min, max, step} = controlParams[key];
      folder.add(optionsObj, key, min, max, step).onChange(value => {
        configOptionsObj[key] = value;
        voxelClient.sendAnimatorChangeCommand(animatorType, configObj);
      }).setValue(optionsObj[key]);
    }
  }
  folder.open();
};

