import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import ShootingStarAnimator from './ShootingStarAnimator';
import {UniformVector3Randomizer, Vector3DirectionRandomizer, UniformFloatRandomizer, ColourRandomizer} from './Randomizers';

import VoxelModel from '../Server/VoxelModel';

export const starShowerDefaultConfig = {
  positionRandomizer: new UniformVector3Randomizer(new THREE.Vector3(0,0,7), new THREE.Vector3(7,7,7)),
  directionRandomizer: new Vector3DirectionRandomizer(new THREE.Vector3(0,0,-1), 0),
  speedRandomizer: new UniformFloatRandomizer(3.0, 8.0), // Speed of a spawned stars in units / second
  colourRandomizer: new ColourRandomizer(new THREE.Color(0,1,0), new THREE.Color(0,1,1)),
  spawnRate: 10.0, // Spawn rate in stars / second
};

/**
 * This class can be thought of as a composition of many shooting stars with
 * lots of levers for randomness (where they appear, how fast they move, etc.).
 */
class StarShowerAnimator extends VoxelAnimator {
  constructor(voxels, config = starShowerDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER; }

  setConfig(c) {
    super.setConfig(c);

    // Make sure the config is populated with the appropriate objects
    const {positionRandomizer, directionRandomizer, speedRandomizer, colourRandomizer} = c;
    this.config.positionRandomizer = new UniformVector3Randomizer(
      new THREE.Vector3(positionRandomizer.min.x, positionRandomizer.min.y, positionRandomizer.min.z),
      new THREE.Vector3(positionRandomizer.max.x, positionRandomizer.max.y, positionRandomizer.max.z)
    );
    this.config.directionRandomizer = new Vector3DirectionRandomizer(
      new THREE.Vector3(directionRandomizer.baseDirection.x, directionRandomizer.baseDirection.y, directionRandomizer.baseDirection.z), directionRandomizer.radAngle
    );
    this.config.speedRandomizer = new UniformFloatRandomizer(speedRandomizer.min, speedRandomizer.max);
    this.config.colourRandomizer = new ColourRandomizer(
      new THREE.Color(colourRandomizer.min.r, colourRandomizer.min.g, colourRandomizer.min.b),
      new THREE.Color(colourRandomizer.max.r, colourRandomizer.max.g, colourRandomizer.max.b),
    );
    
    this.currSpawnRate = Math.max(1.0, c.spawnRate);
  }

  rendersToCPUOnly() { return true; }

  render(dt) {
    // Check whether it's time to spawn a new shooting star
    const spawnTime = (1.0 / this.currSpawnRate);
    while (this.currSpawnTimer >= spawnTime) {
      this.spawnStar();
      this.currSpawnTimer -= spawnTime;
      this.currSpawnCounter++;
      if (this.currSpawnCounter >= this.currSpawnRate) {
        this.currSpawnCounter = 0;
      }
    }

    // Animate/tick the active shooting star animation objects
    this.activeShootingStars.forEach((animator) => {
      animator.render(dt);
    });

    // Clean up all finished animations (only keep the ones that haven't finished)
    this.activeShootingStars = this.activeShootingStars.filter((animator) => (!animator.animationFinished));

    this.currSpawnTimer += dt;
  }

  reset() {
    super.reset();
    this.activeShootingStars = [];
    this.currSpawnCounter = 0;
    this.currSpawnTimer = 0;
  }

  spawnStar() {
    const {
      positionRandomizer, 
      directionRandomizer, 
      speedRandomizer, 
      colourRandomizer,
    } = this.config;

    const starPos    = positionRandomizer.generate();
    const starDir    = directionRandomizer.generate();
    const starSpd    = speedRandomizer.generate();
    const starColour = colourRandomizer.generate();
    
    const starConfig = {
      colour: starColour,
      startPosition: starPos,
      velocity: starDir.multiplyScalar(starSpd),
      fadeTimeSecs: 1.5*Math.PI / starSpd,
      repeat: 0,
    };

    const starAnim = new ShootingStarAnimator(this.voxelModel, starConfig);
    this.activeShootingStars.push(starAnim);
  }

}

export default StarShowerAnimator;