import * as THREE from 'three';

import VoxelAnimator, {REPEAT_INFINITE_TIMES} from './VoxelAnimator';
import ShootingStarAnimator from './ShootingStarAnimator';
import {Randomizer, UniformIntRandomizer, UniformVector3Randomizer, Vector3DirectionRandomizer, UniformFloatRandomizer, ColourRandomizer} from './Randomizers';

const shootingStarShowerDefaultConfig = {
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
class ShootingStarShowerAnimator extends VoxelAnimator {
  constructor(voxels, config = shootingStarShowerDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  setConfig(c) {
    super.setConfig(c);
    this.currSpawnRate = Math.max(1.0, c.spawnRate);
  }

  animate(dt) {

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
      animator.animate(dt);
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

    const starPos = positionRandomizer.generate();
    const starDir = directionRandomizer.generate();
    const starSpd = speedRandomizer.generate();
    const starColour = colourRandomizer.generate();
    
    const starConfig = {
      colour: starColour,
      startPosition: starPos,
      velocity: starDir.multiplyScalar(starSpd),
      fadeTimeSecs: 1.5*Math.PI / starSpd,
      repeat: 0,
    };
    this.activeShootingStars.push(new ShootingStarAnimator(this.voxels, starConfig));
  }

}

export default ShootingStarShowerAnimator;