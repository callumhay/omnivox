import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';

import VoxelAnimator from './VoxelAnimator';
import ShootingStarAnimator from './ShootingStarAnimator';
import {UniformVector3Randomizer, Vector3DirectionRandomizer, UniformFloatRandomizer, ColourRandomizer} from '../Randomizers';

export const starShowerDefaultConfig = {
  minSpawnPos: {x: 0, y: 0, z: VoxelConstants.VOXEL_GRID_MAX_IDX},
  maxSpawnPos: {x: VoxelConstants.VOXEL_GRID_MAX_IDX, y: VoxelConstants.VOXEL_GRID_MAX_IDX, z: VoxelConstants.VOXEL_GRID_MAX_IDX},
  direction: {x: 0, y: 0, z: -1},
  directionVariance: 0,
  speedMin: 3.0,
  speedMax: 8.0,
  colourMin: {r:0, g:1, b:0},
  colourMax: {r:0, g:1, b:1},
  spawnRate: 10.0*Math.pow(VoxelConstants.VOXEL_GRID_SIZE/8, 2), // Spawn rate in stars / second
};

/**
 * This class can be thought of as a composition of many shooting stars with
 * lots of levers for randomness (where they appear, how fast they move, etc.).
 */
class StarShowerAnimator extends VoxelAnimator {
  constructor(voxels, config={...starShowerDefaultConfig}) {
    super(voxels, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER; }

  setConfig(c) {
    super.setConfig(c);

    // Make sure the config is populated with the appropriate objects
    const {minSpawnPos, maxSpawnPos, direction, directionVariance, speedMin, speedMax, colourMin, colourMax} = c;
    this.positionRandomizer = new UniformVector3Randomizer(
      new THREE.Vector3(minSpawnPos.x, minSpawnPos.y, minSpawnPos.z),
      new THREE.Vector3(maxSpawnPos.x, maxSpawnPos.y, maxSpawnPos.z)
    );
    this.directionRandomizer = new Vector3DirectionRandomizer(
      new THREE.Vector3(direction.x, direction.y, direction.z), directionVariance
    );
    this.speedRandomizer = new UniformFloatRandomizer(speedMin, speedMax);
    this.colourRandomizer = new ColourRandomizer(
      new THREE.Color(colourMin.r, colourMin.g, colourMin.b),
      new THREE.Color(colourMax.r, colourMax.g, colourMax.b),
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
    this.activeShootingStars.forEach((animator) => { animator.render(dt); });

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
    const starPos    = this.positionRandomizer.generate();
    const starDir    = this.directionRandomizer.generate();
    const starSpd    = this.speedRandomizer.generate();
    const starColour = this.colourRandomizer.generate();
    
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