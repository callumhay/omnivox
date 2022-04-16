export const REPEAT_INFINITE_TIMES = -1;

const VOXEL_ANIM_TYPE_COLOUR        = "Colour Change";
const VOXEL_ANIM_TEXT               = "Text";
const VOXEL_ANIM_TYPE_SHOOTING_STAR = "Shooting Star";
const VOXEL_ANIM_TYPE_STAR_SHOWER   = "Star Shower";
const VOXEL_ANIM_TYPE_SHAPE_WAVES   = "Shape Waves";
const VOXEL_ANIM_FIRE               = "Fire";
const VOXEL_ANIM_SCENE              = "Scene";
const VOXEL_ANIM_BAR_VISUALIZER     = "Bar Visualizer";
const VOXEL_ANIM_GAMEPAD_DJ         = "Gamepad DJ";

const VOXEL_ANIM_TYPES = [
  VOXEL_ANIM_TYPE_COLOUR,
  VOXEL_ANIM_TYPE_SHOOTING_STAR,
  VOXEL_ANIM_TYPE_STAR_SHOWER,
  VOXEL_ANIM_TYPE_SHAPE_WAVES,
  VOXEL_ANIM_FIRE,
  VOXEL_ANIM_SCENE,
  VOXEL_ANIM_BAR_VISUALIZER,
  VOXEL_ANIM_TEXT,
  VOXEL_ANIM_GAMEPAD_DJ,
];

export const DEFAULT_CROSSFADE_TIME_SECS = 1.0;

class VoxelAnimator {
  constructor(voxelModel, config=null) {

    this.voxelModel = voxelModel;
    this.repeat = 0;
    this.playCounter = 0;
    this.config = {};
    
    this.setConfig(config);
  }

  // Constants for various types of animators
  static get VOXEL_ANIM_TYPE_COLOUR() {return VOXEL_ANIM_TYPE_COLOUR;}
  static get VOXEL_ANIM_TYPE_SHOOTING_STAR() {return VOXEL_ANIM_TYPE_SHOOTING_STAR;}
  static get VOXEL_ANIM_TYPE_STAR_SHOWER() {return VOXEL_ANIM_TYPE_STAR_SHOWER;}
  static get VOXEL_ANIM_TYPE_SHAPE_WAVES() {return VOXEL_ANIM_TYPE_SHAPE_WAVES;}
  static get VOXEL_ANIM_FIRE() {return VOXEL_ANIM_FIRE;}
  static get VOXEL_ANIM_SCENE() {return VOXEL_ANIM_SCENE;}
  static get VOXEL_ANIM_TEXT() {return VOXEL_ANIM_TEXT;}
  static get VOXEL_ANIM_BAR_VISUALIZER() {return VOXEL_ANIM_BAR_VISUALIZER;}
  static get VOXEL_ANIM_GAMEPAD_DJ() {return VOXEL_ANIM_GAMEPAD_DJ;}

  static get VOXEL_ANIM_TYPES() {return VOXEL_ANIM_TYPES;}

  getType() { return null; }

  incrementPlayCounter() { this.playCounter++; }

  setConfig(c) {
    this.config = c ? c : {};
    const {repeat} = this.config;
    if (repeat) {
      this.repeat = repeat;
    }
  }

  setAudioInfo(audioInfo) {}

  render(dt) {}
  rendersToCPUOnly() { return false; }

  reset() {
    this.playCounter = 0;
  }
  stop() {}
}

export default VoxelAnimator;