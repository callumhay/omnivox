import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';

import VoxelAnimator from './VoxelAnimator';
import ShootingStarAnimator from './ShootingStarAnimator';
import {UniformVector3Randomizer, Vector3DirectionRandomizer, UniformFloatRandomizer, ColourRandomizer, RandomHighLowColourCycler} from '../Randomizers';
import {COLOUR_INTERPOLATION_LRGB} from '../Spectrum';

const MIN_MAX_COLOUR_MODE = "Min Max";
const RANDOM_COLOUR_MODE  = "Random";

export const starShowerDefaultConfig = {
  minSpawnPos: {x: 0, y: 0, z: VoxelConstants.VOXEL_GRID_MAX_IDX},
  maxSpawnPos: {x: VoxelConstants.VOXEL_GRID_MAX_IDX, y: VoxelConstants.VOXEL_GRID_MAX_IDX, z: VoxelConstants.VOXEL_GRID_MAX_IDX},
  direction: {x: 0, y: 0, z: -1},
  directionVariance: 0,
  colourMode: MIN_MAX_COLOUR_MODE,
  speedMin: 3.0,
  speedMax: 8.0,

  // Low High Colour Mode
  colourMin: {r:0, g:1, b:0},
  colourMax: {r:0, g:1, b:1},
  // Random Colour Mode
  ...RandomHighLowColourCycler.randomColourCyclerDefaultConfig,

  colourInterpolationType: COLOUR_INTERPOLATION_LRGB,

  spawnRate: 10.0 * Math.pow(VoxelConstants.VOXEL_GRID_SIZE / 8.0, 2), // Spawn rate in stars / second
};


/**
 * This class can be thought of as a composition of many shooting stars with
 * lots of levers for randomness (where they appear, how fast they move, etc.).
 */
class StarShowerAnimator extends VoxelAnimator {
  constructor(voxels, config={...starShowerDefaultConfig}) {
    super(voxels, config);
  }

  static get MIN_MAX_COLOUR_MODE() { return MIN_MAX_COLOUR_MODE; }
  static get RANDOM_COLOUR_MODE() { return RANDOM_COLOUR_MODE; }
  static get COLOUR_MODES() {
    return [
      MIN_MAX_COLOUR_MODE,
      RANDOM_COLOUR_MODE,
    ];
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER; }

  load() {
    this.positionRandomizer = new UniformVector3Randomizer();
    this.directionRandomizer = new Vector3DirectionRandomizer();
    this.speedRandomizer = new UniformFloatRandomizer();
    this.randomColourCycler = new RandomHighLowColourCycler();
    this.colourRandomizer = new ColourRandomizer();
    this.activeShootingStars = [];
    this.currSpawnCounter = 0;
    this.currSpawnTimer = 0;
    this.currSpawnRate = 0;
  }
  unload() {
    this.positionRandomizer = null;
    this.directionRandomizer = null;
    this.speedRandomizer = null;
    this.randomColourCycler = null;
    this.colourRandomizer = null;
    this.activeShootingStars = null;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; } // Don't load everything on initialization

    // Make sure the config is populated with the appropriate objects
    const {
      spawnRate, minSpawnPos, maxSpawnPos, direction, directionVariance, 
      speedMin, speedMax, colourMode, randomColourHoldTime, randomColourTransitionTime,
    } = this.config;

    this.positionRandomizer.set(
      new THREE.Vector3(minSpawnPos.x, minSpawnPos.y, minSpawnPos.z), 
      new THREE.Vector3(maxSpawnPos.x, maxSpawnPos.y, maxSpawnPos.z)
    );
    this.directionRandomizer.set(new THREE.Vector3(direction.x, direction.y, direction.z), directionVariance);
    this.speedRandomizer.set(speedMin, speedMax);

    this.randomColourCycler.setConfig({randomColourHoldTime, randomColourTransitionTime});

    switch (colourMode) {
      case MIN_MAX_COLOUR_MODE:
      default: {
        const {colourMin, colourMax} = this.config;
        this.colourRandomizer.set(colourMin, colourMax);
        break;
      }
      case RANDOM_COLOUR_MODE: {
        const {lowTempColour, highTempColour} = this.randomColourCycler.currRandomColours;
        this.colourRandomizer.set(lowTempColour, highTempColour);
        break;
      }
    }

    this.currSpawnRate = Math.max(1.0, spawnRate);
  }

  reset() {
    this.activeShootingStars = [];
    this.currSpawnCounter = 0;
    this.currSpawnTimer = 0;
    this.randomColourCycler.reset();
  }

  rendersToCPUOnly() { return true; }

  render(dt) {
    const {colourInterpolationType, colourMode} = this.config;

    // Check whether it's time to spawn a new shooting star
    const spawnTime = (1.0 / this.currSpawnRate);
    while (this.currSpawnTimer >= spawnTime) {
      let starColour = null;
      switch (colourMode) {
        case MIN_MAX_COLOUR_MODE:
        default:
          starColour = this.colourRandomizer.generate(colourInterpolationType);
          break;
        case RANDOM_COLOUR_MODE:
          const {lowTempColour, highTempColour}  = this.randomColourCycler.tick(this.currSpawnTimer, colourInterpolationType);
          starColour = ColourRandomizer.getRandomColour(lowTempColour, highTempColour, colourInterpolationType);
          break;
      }

      this._spawnStar(starColour);
      this.currSpawnTimer -= spawnTime;
      this.currSpawnCounter++;
      if (this.currSpawnCounter >= this.currSpawnRate) { this.currSpawnCounter = 0; }
    }

    // Animate/tick the active shooting star animation objects
    this.activeShootingStars.forEach((animator) => { animator.render(dt); });

    // Clean up all finished animations (only keep the ones that haven't finished)
    this.activeShootingStars = this.activeShootingStars.filter((animator) => (!animator.animationFinished));

    this.currSpawnTimer += dt;
  }

  _spawnStar(starColour) {
    const starPos  = this.positionRandomizer.generate();
    const starDir  = this.directionRandomizer.generate();
    const starSpd  = this.speedRandomizer.generate();

    const starConfig = {
      colour: starColour,
      startPosition: starPos,
      velocity: starDir.multiplyScalar(starSpd),
      fadeTimeSecs: 1.5*Math.PI / starSpd
    };

    const starAnim = new ShootingStarAnimator(this.voxelModel);
    starAnim.load();
    starAnim.setConfig(starConfig);

    this.activeShootingStars.push(starAnim);
  }

}

export default StarShowerAnimator;
