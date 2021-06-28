import VoxelAnimator from '../../Animation/VoxelAnimator';
import FireAnimator, {fireAnimatorDefaultConfig} from '../../Animation/FireAnimator';
import {ColourSystems, COLOUR_INTERPOLATION_TYPES} from '../../Spectrum';
import AnimCP from './AnimCP';

class FireAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...fireAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_FIRE; }

  buildFolder() {
    const {gridSize} = this.masterCP;
    const folder = this.masterCP.pane.addFolder({title: "Fire Controls"});
    this.addControl(folder, 'speed', {label: "Speed", min: 0.1, max: 5.0, step: 0.1});
    this.addControl(folder, 'buoyancy', {label: "Buoyancy", min: 0.1, max: 8.0, step: 0.1});
    this.addControl(folder, 'cooling', {label: "Cooling", min: 0.1, max: 1.5, step: 0.01});
    this.addControl(folder, 'vorticityConfinement', {label: "Vorticity", min: 1, max: 20, step: 1});
    this.addControl(folder, 'initialIntensityMultiplier', {label: "Initial Intensity", min: 0.1, max: 10, step: 0.1});
    
    // Colour modes -------
    // Temperature Colour Mode
    const tempColourFolder = folder.addFolder({title: "Temperature Colour Mode"});
    this.addControl(tempColourFolder, 'spectrumTempMin', {label: "Min Temperature", min: 0, max: 5000, step:100});
    this.addControl(tempColourFolder, 'spectrumTempMax', {label: "Max Temperature", min: 0, max: 10000, step:100});
    this.addList(tempColourFolder, 'colourSystem', Object.keys(ColourSystems), "Colour System");
    tempColourFolder.hidden = true;
    folder.remove(tempColourFolder);
    // Low/High Temperature Colour Mode
    const lowHighColourFolder = folder.addFolder({title: "Low/High Temperature Colour Mode"});
    this.addControl(lowHighColourFolder, 'lowTempColour', {label: "Low Colour"});
    this.addControl(lowHighColourFolder, 'highTempColour', {label: "High Colour"});
    this.addList(lowHighColourFolder, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES, "Colour Interpolation");
    lowHighColourFolder.hidden = true;
    folder.remove(lowHighColourFolder);
    // Random Colour Mode
    const randomColourFolder = folder.addFolder({title: "Random Colour Mode"});
    this.addControl(randomColourFolder, 'randomColourHoldTime', {label: "Hold Time (s)", min: 0.1, max: 30, step: 0.1});
    this.addControl(randomColourFolder, 'randomColourTransitionTime', {label: "Transition Time (s)", min: 0.1, max: 30, step: 0.1});
    this.addList(randomColourFolder, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES, "Colour Interpolation");
    randomColourFolder.hidden = true;
    folder.remove(randomColourFolder);

    const self = this;
    const onColourModeChange = ev => {
      tempColourFolder.hidden = true;
      lowHighColourFolder.hidden = true;
      randomColourFolder.hidden = true;
      switch (ev.value) {
        default:
        case FireAnimator.TEMPERATURE_COLOUR_MODE:
          tempColourFolder.hidden = false;
          break;
        case FireAnimator.LOW_HIGH_TEMP_COLOUR_MODE:
          lowHighColourFolder.hidden = false;
          break;
        case FireAnimator.RANDOM_COLOUR_MODE:
          randomColourFolder.hidden = false;
          break;
      }
      self.colourMode = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, self.config);
    };
    
    this.addList(folder, 'colourMode', FireAnimator.COLOUR_MODES, "Colour Mode", onColourModeChange);

    folder.add(tempColourFolder);
    folder.add(lowHighColourFolder);
    folder.add(randomColourFolder);

    const wallSubFolder = folder.addFolder({title: "Wall Position"});
    const wallConstraints = {min: -1, max: gridSize/2, step:1};
    this.addControl(wallSubFolder, 'wallPosX', {label: "Wall Position (+x)", ...wallConstraints});
    this.addControl(wallSubFolder, 'wallNegX', {label: "Wall Position (-x)", ...wallConstraints});
    this.addControl(wallSubFolder, 'wallPosY', {label: "Wall Position (+y)", ...wallConstraints});
    this.addControl(wallSubFolder, 'wallPosZ', {label: "Wall Position (+z)", ...wallConstraints});
    this.addControl(wallSubFolder, 'wallNegZ', {label: "Wall Position (-z)", ...wallConstraints});

    // Audio visualization for the fire animator
    const audioFolder = folder.addFolder({title: "Audio Visualization"});
    this.addControl(audioFolder, 'audioVisualizationOn', {label: "Visualization On"});
    this.addControl(audioFolder, 'levelMax', {label: "Max Level", min: 0.1, max: 5, step: 0.01});
    this.addControl(audioFolder, 'gamma', {label: "Gamma", min: 1, max: 8, step: 0.1});
    //this.addControl(audioFolder, 'fadeFactor', {label: "Fade Factor", min: 0, max: 0.1, step: 0.001}); // No fade factor on the fire vis
    audioFolder.addSeparator();
    this.addControl(audioFolder, 'audioNoiseAddition', {label: "Noise Multiplier", min: 0, max: 1, step: 0.01});
    this.addControl(audioFolder, 'audioSpeedMultiplier', {label: "Speed Multiplier", min: 0.1, max: 3, step: 0.01});
    this.addControl(audioFolder, 'audioCoolingMultiplier', {label: "Cooling Multiplier", min: 0, max: 5, step: 0.1});
    this.addControl(audioFolder, 'audioBuoyancyMultiplier', {label: "Buoyancy Multiplier", min: 0, max: 5, step: 0.1});
    this.addControl(audioFolder, 'audioTurbulenceMultiplier', {label: "Turbulence Multiplier", min: 0, max: 5, step: 0.1});

    this.masterCP.buildResetButton(folder);
    return folder;
  }
}

export default FireAnimCP;