import {Pane} from 'tweakpane';

import VoxelConstants from '../../VoxelConstants';
import VoxelAnimator, {DEFAULT_CROSSFADE_TIME_SECS} from '../../Animation/VoxelAnimator';

import {CHANGE_EVENT, CLICK_EVENT} from '../controlpanelfuncs';

import StartupAnimCP from './StartupAnimCP';
import SoundCP from './SoundCP';
import ColourAnimCP from './ColourAnimCP';
import TextAnimCP from './TextAnimCP';
import StarShowerAnimCP from './StarShowerAnimCP';
import ShapeWaveAnimCP from './ShapeWaveAnimCP';
import FireAnimCP from './FireAnimCP';
import BarVisualizerAnimCP from './BarVisualizerAnimCP';
import SceneAnimCP from './SceneAnimCP';
import GamepadDJCP from './GamepadDJCP';
import BlockVisualizerAnimCP from './BlockVisualizerAnimCP';


class MasterCP {
  constructor(gridSize, controllerClient, soundManager) {

    this.gridSize = gridSize;
    this.controllerClient = controllerClient;
    this.soundManager = soundManager;

    this.pane = new Pane({
      title: VoxelConstants.PROJECT_NAME + " Controller",
      container: document.getElementById("controlContainer"), 
      expanded: true
    });

    this.settings = {...this.settings,
      animatorType: VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR,
      crossfadeTime: DEFAULT_CROSSFADE_TIME_SECS,
      brightness: VoxelConstants.DEFAULT_BRIGHTNESS_MULTIPLIER,
    };
    
    this.childControlPanels = {};
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_TYPE_STARTUP] = new StartupAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR] = new ColourAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_TEXT] = new TextAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER] = new StarShowerAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES] = new ShapeWaveAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_FIRE] = new FireAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER] = new BarVisualizerAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_BLOCK_VISUALIZER] = new BlockVisualizerAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_SCENE] = new SceneAnimCP(this);
    this.childControlPanels[VoxelAnimator.VOXEL_ANIM_GAMEPAD_DJ] = new GamepadDJCP(this);

    this._hideSubFolders();
    this._removeSubFolders();

    const self = this;

    // Global control parameters
    this.pane.addInput(this.settings, 'crossfadeTime', {label: "Crossfade Time (s)", min: 0, max: 10, step:0.1}).on(CHANGE_EVENT, ev => {
      self.controllerClient.sendCrossfadeTime(ev.value);
    });
    this.pane.addInput(this.settings, 'brightness', {label: "Brightness", min:0, max:1, step:0.01}).on(CHANGE_EVENT, ev => {
      self.controllerClient.sendGlobalBrightness(ev.value);
    });
    this.soundControlPanel = new SoundCP(this);

    const animatorList = Object.keys(this.childControlPanels);
    this.animatorTypeBlade = this.pane.addBlade({
      view: 'list',
      label: 'Animator Type',
      options: animatorList.map(a => ({text: a, value: a})),
      value: null
    }).on(CHANGE_EVENT, ev => {
      const {value} = ev;
      self._updateAnimatorType(value); 
    });
    this.animatorTypeBlade.value = this.settings.animatorType;
    this._addSubFolders();

    this.pane.refresh();
  }

  dispose() {
    this.pane.dispose();
  }

  updateBrightness(brightness) {
    this.settings.brightness = brightness;
  }

  updateAnimator(animatorType, config) {
    if (animatorType in this.childControlPanels) {
      // Update the child panel with the new config and reload its settings
      const childPanel = this.childControlPanels[animatorType];
      childPanel.updateConfig(config);
      this.animatorTypeBlade.value = animatorType;
    }
    else {
      console.error("Animator type Not implemented!");
    }
  }

  _hideSubFolders() { 
    Object.values(this.childControlPanels).forEach(child => { child.folder.hidden = true; });
  }
  _removeSubFolders() {
    Object.values(this.childControlPanels).forEach(child => { this.pane.remove(child.folder); });
  }
  _addSubFolders() {
    Object.values(this.childControlPanels).forEach(child => { this.pane.add(child.folder); });
  }

  _updateAnimatorType(animType) {
    this.settings.animatorType = animType;
    
    this._hideSubFolders();

    if (animType in this.childControlPanels) {
      const child = this.childControlPanels[animType];
      child.folder.hidden = false;
      this.controllerClient.sendAnimatorChangeCommand(animType, child.config);
    }
    else {
      console.error("Animator type not implemented!");
    }

    this.controllerClient.sendClearCommand(0,0,0);
    //this.pane.refresh();
  }

  sendReset() {
    this.controllerClient.sendRoutineResetCommand();
    this.controllerClient.sendClearCommand(0, 0, 0);
  }
  
  buildResetButton(parent) {
    const self = this;
    parent.addButton({title:'Reset Animation'}).on(CLICK_EVENT, () => {
      self.sendReset();
    });
  }

}

export default MasterCP;
