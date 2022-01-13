import VoxelAnimator from '../../Animation/VoxelAnimator';
import StarShowerAnimator, {starShowerDefaultConfig} from '../../Animation/StarShowerAnimator';
import {CHANGE_EVENT} from '../controlpanelfuncs';
import AnimCP from './AnimCP';
import VoxelConstants from '../../VoxelConstants';
import { COLOUR_INTERPOLATION_TYPES } from '../../Spectrum';

class StarShowerAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...starShowerDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER; }

  buildFolder() {
    const self = this;
    const folder = this.masterCP.pane.addFolder({title: "Star Shower Controls"});

    // Colour Mode Subfolders --------

    // Random colour mode
    const randomColourModeSubfolder = folder.addFolder({title: StarShowerAnimator.RANDOM_COLOUR_MODE + " Colour Mode"});
    this.addControl(randomColourModeSubfolder, 'randomColourHoldTime', {label: "Hold Time (s)", min: 0.1, max: 30, step: 0.1});
    this.addControl(randomColourModeSubfolder, 'randomColourTransitionTime', {label: "Transition Time (s)", min: 0.1, max: 30, step: 0.1});
    this.addList(randomColourModeSubfolder, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES, "Colour Interpolation");
    randomColourModeSubfolder.hidden = true;
    folder.remove(randomColourModeSubfolder);

    // Min max colour mode
    const minMaxColourModeSubfolder = folder.addFolder({title: StarShowerAnimator.MIN_MAX_COLOUR_MODE + " Colour Mode"});
    this.addControl(minMaxColourModeSubfolder, 'colourMin', {label: "Min Colour"});
    this.addControl(minMaxColourModeSubfolder, 'colourMax', {label: "Max Colour"});
    this.addList(minMaxColourModeSubfolder, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES, "Colour Interpolation");
    folder.remove(minMaxColourModeSubfolder);
    // --------------------------------

    const onColourModeChange = ev => {
      randomColourModeSubfolder.hidden = true;
      minMaxColourModeSubfolder.hidden = true;
      switch (ev.value) {
        case StarShowerAnimator.RANDOM_COLOUR_MODE:
          randomColourModeSubfolder.hidden = false;
          break;
        case StarShowerAnimator.MIN_MAX_COLOUR_MODE:
        default:
          minMaxColourModeSubfolder.hidden = false;
          break;
      }
      self.config.colourMode = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    };
    this.addList(folder, 'colourMode', StarShowerAnimator.COLOUR_MODES, "Colour Mode", onColourModeChange);

    // Re-add all the subfolders after the selection list widget
    folder.add(randomColourModeSubfolder);
    folder.add(minMaxColourModeSubfolder);


    this.addControl(folder, 'spawnRate', {label: "Spawn Rate", min: 1, max:100, step: 1});
    this.addControl(folder, 'speedMin', {label: "Min Speed", min:1, max:25, step:0.5});
    this.addControl(folder, 'speedMax', {label: "Max Speed", min:1, max:25, step:0.5});
    
    
    // Setup the direction control
    {
      const directionStrs = VoxelConstants.ORTHO_DIR_STRS;
      const directionVecs = VoxelConstants.ORTHO_DIR_VEC3S;
      const dirOptions = directionStrs.map(str => {
        return {text: str, value: str};
      });
      
      const onChangeDir = ev => {
        const idx = directionStrs.indexOf(ev.value);
        self.config.direction = {x: directionVecs[idx].x, y: directionVecs[idx].y, z:directionVecs[idx].z};
        self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
      };

      // Find the index of the initial value for the direction...
      const {direction} = this.settings;
      const isDir = (el) => (el.x === direction.x && el.y === direction.y && el.z === direction.z);
      const initialDirIdx = directionVecs.findIndex(isDir);
      const initialDirStr = directionStrs[initialDirIdx];

      const blade = folder.addBlade({view: 'list', label: "Direction", options: dirOptions, value: ''}).on(CHANGE_EVENT, onChangeDir);
      blade.value = initialDirStr;
    }

    this.addControl(folder, 'directionVariance', {label: "Direction Variance (Radians)", min:0, max:Math.PI, step:Math.PI/16});

    const positionCompMax = 2*this.masterCP.gridSize;
    const posCompConstraints = { min:-positionCompMax, max:positionCompMax, step:1 };
    this.addControl(folder, 'minSpawnPos', {
      label: "Min Spawn Posiition", x: {...posCompConstraints}, y: {...posCompConstraints}, z: {...posCompConstraints}
    });
    this.addControl(folder, 'maxSpawnPos', {
      label: "Max Spawn Position", x: {...posCompConstraints}, y: {...posCompConstraints}, z: {...posCompConstraints}
    });

    this.masterCP.buildResetButton(folder);
    return folder;
  }
}

export default StarShowerAnimCP;