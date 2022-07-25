const VOXEL_ANIM_TYPE_STARTUP       = "Startup";
const VOXEL_ANIM_TYPE_COLOUR        = "Colour Change";
const VOXEL_ANIM_TEXT               = "Text";
const VOXEL_ANIM_TYPE_SHOOTING_STAR = "Shooting Star";
const VOXEL_ANIM_TYPE_STAR_SHOWER   = "Star Shower";
const VOXEL_ANIM_TYPE_SHAPE_WAVES   = "Shape Waves";
const VOXEL_ANIM_FIRE               = "Fire";
const VOXEL_ANIM_SCENE              = "Scene";
const VOXEL_ANIM_BAR_VISUALIZER     = "Bar Visualizer";
const VOXEL_ANIM_BLOCK_VISUALIZER   = "Block Visualizer";
const VOXEL_ANIM_GAMEPAD_DJ         = "Gamepad DJ";
const VOXEL_ANIM_DOOM               = "Doom";
const VOXEL_ANIM_VIDEO              = "Video";

const VOXEL_ANIM_TYPES = [
  VOXEL_ANIM_TYPE_COLOUR,
  VOXEL_ANIM_TYPE_SHOOTING_STAR,
  VOXEL_ANIM_TYPE_STAR_SHOWER,
  VOXEL_ANIM_TYPE_SHAPE_WAVES,
  VOXEL_ANIM_FIRE,
  VOXEL_ANIM_SCENE,
  VOXEL_ANIM_BAR_VISUALIZER,
  VOXEL_ANIM_BLOCK_VISUALIZER,
  VOXEL_ANIM_TEXT,
  VOXEL_ANIM_GAMEPAD_DJ,
  VOXEL_ANIM_DOOM,
  VOXEL_ANIM_VIDEO,
];

export const DEFAULT_CROSSFADE_TIME_SECS = 1.0;

class VoxelAnimator {
  constructor(voxelModel, config=null) {
    this.voxelModel = voxelModel;
    this.config = {};
    this.setConfig(config, true);
  }

  // Constants for various types of animators
  static get VOXEL_ANIM_TYPE_STARTUP() {return VOXEL_ANIM_TYPE_STARTUP;}
  static get VOXEL_ANIM_TYPE_COLOUR() {return VOXEL_ANIM_TYPE_COLOUR;}
  static get VOXEL_ANIM_TYPE_SHOOTING_STAR() {return VOXEL_ANIM_TYPE_SHOOTING_STAR;}
  static get VOXEL_ANIM_TYPE_STAR_SHOWER() {return VOXEL_ANIM_TYPE_STAR_SHOWER;}
  static get VOXEL_ANIM_TYPE_SHAPE_WAVES() {return VOXEL_ANIM_TYPE_SHAPE_WAVES;}
  static get VOXEL_ANIM_FIRE() {return VOXEL_ANIM_FIRE;}
  static get VOXEL_ANIM_SCENE() {return VOXEL_ANIM_SCENE;}
  static get VOXEL_ANIM_TEXT() {return VOXEL_ANIM_TEXT;}
  static get VOXEL_ANIM_BAR_VISUALIZER() {return VOXEL_ANIM_BAR_VISUALIZER;}
  static get VOXEL_ANIM_BLOCK_VISUALIZER() {return VOXEL_ANIM_BLOCK_VISUALIZER;}
  static get VOXEL_ANIM_GAMEPAD_DJ() {return VOXEL_ANIM_GAMEPAD_DJ;}
  static get VOXEL_ANIM_DOOM() {return VOXEL_ANIM_DOOM;}
  static get VOXEL_ANIM_VIDEO() {return VOXEL_ANIM_VIDEO;}

  static get VOXEL_ANIM_TYPES() {return VOXEL_ANIM_TYPES;}

  getType() { return null; }

  load() {}   // Called whenever the animator is (re)loaded by the controller
  unload() {} // Called whenever the animator is no longer active (after the crossfade has completed)
  reset() {}  // Called when the "reset" button is hit in the controller

  setConfig(c, init=false) {
    this.config = c ? c : {};
    return !init;
  }

  setAudioInfo(audioInfo) {}

  rendersToCPUOnly() { return false; }
  
  render(dt) {}
}

export default VoxelAnimator;