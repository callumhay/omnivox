import VoxelAnimator from '../../Animation/VoxelAnimator';
import BarVisualizerAnimator, {barVisualizerAnimatorDefaultConfig} from '../../Animation/BarVisualizerAnimator';

import AnimCP from './AnimCP';
import { COLOUR_INTERPOLATION_TYPES } from '../../Spectrum';

class BarVisualizerAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...barVisualizerAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER; }

  buildFolder() {
    const self = this;
    const {pane} = this.masterCP;
    const folder = pane.addFolder({title: "Bar Visualizer Controls"});

    // Colour Mode Subfolders --------

    // Random colour mode
    const randomColourModeSubfolder = folder.addFolder({title: "Random Colour Mode"});
    this.addControl(randomColourModeSubfolder, 'randomColourHoldTime', {label: "Hold Time (s)", min: 0.1, max: 30, step: 0.1});
    this.addControl(randomColourModeSubfolder, 'randomColourTransitionTime', {label: "Transition Time (s)", min: 0.1, max: 30, step: 0.1});
    this.addList(randomColourModeSubfolder, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES, "Colour Interpolation");
    randomColourModeSubfolder.hidden = true;
    folder.remove(randomColourModeSubfolder);

    // Low-High colour mode
    const lowHighColourModeSubfolder = folder.addFolder({title: "Low High Colour Mode"});
    this.addControl(lowHighColourModeSubfolder, 'lowColour', {label: "Low Colour"});
    this.addControl(lowHighColourModeSubfolder, 'highColour', {label: "High Colour"});
    this.addList(lowHighColourModeSubfolder, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES, "Colour Interpolation");
    folder.remove(lowHighColourModeSubfolder);
    // --------------------------------

    const onColourModeChange = ev => {
      randomColourModeSubfolder.hidden = true;
      lowHighColourModeSubfolder.hidden = true;
      switch (ev.value) {
        case BarVisualizerAnimator.RANDOM_COLOUR_MODE:
          randomColourModeSubfolder.hidden = false;
          break;
        case BarVisualizerAnimator.LOW_HIGH_COLOUR_MODE:
        default:
          lowHighColourModeSubfolder.hidden = false;
          break;
      }
      self.config.colourMode = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    };
    this.addList(folder, 'colourMode', BarVisualizerAnimator.COLOUR_MODES, "Colour Mode", onColourModeChange);

    // Re-add all the subfolders after the selection list widget
    folder.add(randomColourModeSubfolder);
    folder.add(lowHighColourModeSubfolder);

    // Display Type Subfolders ----------
    // Moving history bars
    const movingHistorySubfolder = folder.addFolder({title: "Moving History Bars Display Mode"});
    this.addControl(movingHistorySubfolder, 'speed', {label: "Speed", min: 1, max: 20, step: 0.1});
    this.addControl(movingHistorySubfolder, 'tempoMultiplier', {label: "Tempo Multiplier", min: 1, max: 100, step: 1});
    this.addList(movingHistorySubfolder, 'direction', BarVisualizerAnimator.DIRECTION_TYPES, "Direction");
    movingHistorySubfolder.hidden = true;
    folder.remove(movingHistorySubfolder);
    // Static bars
    const staticSubfolder = folder.addFolder({title: "Static Bars Display Mode"});
    this.addControl(staticSubfolder, 'splitLevels', {label: "Split Levels?"});
    this.addControl(staticSubfolder, 'centerSorted', {label: "Center Sorted?"});
    staticSubfolder.hidden = true;
    folder.remove(staticSubfolder);

    const onDisplayModeChanged = ev => {
      movingHistorySubfolder.hidden = true;
      staticSubfolder.hidden = true;
      switch (ev.value) {
        case BarVisualizerAnimator.MOVING_HISTORY_BARS_DISPLAY_TYPE:
          movingHistorySubfolder.hidden = false;
          break;
        case BarVisualizerAnimator.STATIC_BARS_DISPLAY_TYPE:
        default:
          staticSubfolder.hidden = false;
          break;
      }
      self.config.displayMode = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    }
    this.addList(folder, 'displayMode', BarVisualizerAnimator.DISPLAY_MODE_TYPES, "Display Mode", onDisplayModeChanged);

    // Re-add all the subfolders after the selection list widget
    folder.add(movingHistorySubfolder);
    folder.add(staticSubfolder);

    // Audio visualization parameters
    const audioFolder = folder.addFolder({title: "Audio Parameters"});
    this.addControl(audioFolder, 'levelMax', {label: "Max Level", min: 0.1, max: 5, step: 0.01});
    this.addControl(audioFolder, 'gamma', {label: "Gamma", min: 1, max: 8, step: 0.1});
    this.addControl(audioFolder, 'fadeFactor', {label: "Fade Factor", min: 0, max: 0.1, step: 0.001});

    return folder;
  }
}

export default BarVisualizerAnimCP;
