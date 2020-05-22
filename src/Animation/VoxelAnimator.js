export const REPEAT_INFINITE_TIMES = -1;

const VOXEL_ANIM_TYPE_COLOUR        = "Colour Change"
const VOXEL_ANIM_TYPE_SHOOTING_STAR = "Shooting Star";
const VOXEL_ANIM_TYPE_STAR_SHOWER   = "Star Shower";
const VOXEL_ANIM_TYPE_SHAPE_WAVES   = "Shape Waves";
const VOXEL_ANIM_TYPE_GAME_OF_LIFE  = "Game of Life";
const VOXEL_ANIM_FIRE               = "Fire";
const VOXEL_ANIM_SCENE              = "Scene";
const VOXEL_ANIM_SOUND_VIZ          = "Visualizer";

const VOXEL_ANIM_TYPES = [
  VOXEL_ANIM_TYPE_COLOUR,
  VOXEL_ANIM_TYPE_SHOOTING_STAR,
  VOXEL_ANIM_TYPE_STAR_SHOWER,
  VOXEL_ANIM_TYPE_SHAPE_WAVES,
  VOXEL_ANIM_TYPE_GAME_OF_LIFE,
  VOXEL_ANIM_FIRE,
  VOXEL_ANIM_SCENE,
  VOXEL_ANIM_SOUND_VIZ,
];

class VoxelAnimator {
  constructor(voxels, config=null) {
    this.voxelModel = voxels;
    this.repeat = 0;
    
    let _playCounter = 0;
    this.setPlayCounter = (val) => { _playCounter = val; };
    this.getPlayCounter = () => (_playCounter);
    this.incrementPlayCounter = () => { _playCounter++; };

    this.setConfig(config);
  }

  // Constants for various types of animators
  static get VOXEL_ANIM_TYPE_COLOUR() {return VOXEL_ANIM_TYPE_COLOUR;}
  static get VOXEL_ANIM_TYPE_SHOOTING_STAR() {return VOXEL_ANIM_TYPE_SHOOTING_STAR;}
  static get VOXEL_ANIM_TYPE_STAR_SHOWER() {return VOXEL_ANIM_TYPE_STAR_SHOWER;}
  static get VOXEL_ANIM_TYPE_SHAPE_WAVES() {return VOXEL_ANIM_TYPE_SHAPE_WAVES;}
  static get VOXEL_ANIM_TYPE_GAME_OF_LIFE() {return VOXEL_ANIM_TYPE_GAME_OF_LIFE;}
  static get VOXEL_ANIM_FIRE() {return VOXEL_ANIM_FIRE;}
  static get VOXEL_ANIM_SCENE() {return VOXEL_ANIM_SCENE;}
  static get VOXEL_ANIM_SOUND_VIZ() {return VOXEL_ANIM_SOUND_VIZ;}

  static get VOXEL_ANIM_TYPES() {return VOXEL_ANIM_TYPES;}

  getType() { return null; }

  setConfig(c) {
    this.config = c ? c : {};
    const {repeat} = this.config;
    if (repeat) {
      this.repeat = repeat;
    }
  }

  render(dt) {}

  reset() {
    this.setPlayCounter(0);
  }
  stop() {}
}

export default VoxelAnimator;