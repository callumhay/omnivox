import * as THREE from 'three';
import seedrandom from 'seedrandom';

import VoxelAnimator from './VoxelAnimator';

export const gameOfLifeAnimatorDefaultConfig = {
  seed: "abc",
  speed: 0.5,
  aliveColour: new THREE.Color(1,1,1),
  deadColour: new THREE.Color(0,0,0),
  repeat: 0,
};

/**
 * Animates a 3D generalization of Conway's "Game of Life".
 */
class GameOfLifeAnimator extends VoxelAnimator {
  constructor(voxels, config = gameOfLifeAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE; }

  setConfig(c) {
    super.setConfig(c);
    this.reset();
  }

  render(dt) {
    super.render(dt);

    const {speed} = this.config;

    while (this.currTimeCounter >= speed) {
      this.simulateAndDrawLifeStep();
      this.currTimeCounter = 0;
    }

    this.currTimeCounter += dt;
  }

  reset() {
    super.reset();
    
    // Reset the basic member variables
    //this.activeColourAnimators = [];
    this.aliveVoxels = {};
    this.currState = [];
    this.currTimeCounter = 0;

    // Reset the initial state of the game based on the current seed
    const {seed, aliveColour, deadColour} = this.config;
    const rng = seedrandom(seed); // Seeded random number generator for values in [0,1)
    
    const VOXEL_X_SIZE = this.voxels.gridSize;
    const VOXEL_Y_SIZE = this.voxels.gridSize;
    const VOXEL_Z_SIZE = this.voxels.gridSize;

    for (let x = 0; x < VOXEL_X_SIZE; x++) {
      let currXArr = [];
      this.currState.push(currXArr);
      for (let y = 0; y < VOXEL_Y_SIZE; y++) {
        let currYArr = [];
        currXArr.push(currYArr);
        for (let z = 0; z < VOXEL_Z_SIZE; z++) {
          currYArr.push({
            x: x,
            y: y,
            z: z,
            isAlive: rng() < 0.3,
            numLivingNeighbours: 0,
          });
        }
      }
    }

    // Calculate all the living neighbours for each voxel
    for (let x = 0; x < VOXEL_X_SIZE; x++) {
      for (let y = 0; y < VOXEL_Y_SIZE; y++) {
        for (let z = 0; z < VOXEL_Z_SIZE; z++) {
          const currVoxelState = this.currState[x][y][z];
          if (currVoxelState.isAlive) {
            this.addVoxelToAliveVoxels(currVoxelState);
            this.voxels.drawPoint(new THREE.Vector3(x,y,z), aliveColour);
          }
          else {
            this.voxels.drawPoint(new THREE.Vector3(x,y,z), deadColour);
          }

          // Count the neighbours that are alive
          currVoxelState.numLivingNeighbours = 0;
          this.neighbourIter(currVoxelState, 
            (centerVoxel, neighbourVoxel) => centerVoxel.numLivingNeighbours += (neighbourVoxel.isAlive ? 1 : 0));
        }
      }
    }

    // We've seeded a random state, now we need to make sure it's coherent with the rules of the game
    // and that we draw it into the voxels
    this.simulateAndDrawLifeStep();
  }

  /*
   * Define environment E as the number of living neighbors required to prevent a currently living cell
   * from expiring, with El <= E <= Eu. Fertility F is the number of neighbors
   * required to create a new living cell, with Fl <= F <= Fu.
   * We define the transition rule as R = (El, Eu, Fl, Fu).
   */
  simulateAndDrawLifeStep() {
    // R = (5,7,6,6) is the best configuration for a 3D game of life that is most
    // stable and similar to the 2D game
    // Furthermore:
    // 1. A non-living cell in the neighbourhood cannot have six living neighbours.
    // 2. A living cell cannot have five neighbours.
    
    const El = 5;
    const Eu = 7;
    const Fl = 6;
    const Fu = 6;

    const VOXEL_X_SIZE = this.voxels.gridSize;
    const VOXEL_Y_SIZE = this.voxels.gridSize;
    const VOXEL_Z_SIZE = this.voxels.gridSize;

    // Go through each voxel and simulate a step in the 3D "Game of Life"
    const birthedVoxels = [];
    const killedVoxels = [];
    
    for (let x = 0; x < VOXEL_X_SIZE; x++) {
      for (let y = 0; y < VOXEL_Y_SIZE; y++) {
        for (let z = 0; z < VOXEL_Z_SIZE; z++) {
          const currVoxelState = this.currState[x][y][z];

          if (currVoxelState.isAlive) {
            // Will the cell expire?
            if (currVoxelState.numLivingNeighbours < El || currVoxelState.numLivingNeighbours > Eu) {
              killedVoxels.push(currVoxelState);
            }
          }
          else {
            // Will the cell be birthed?
            if (currVoxelState.numLivingNeighbours >= Fl && currVoxelState.numLivingNeighbours <= Fu) {
              birthedVoxels.push(currVoxelState);
            }
          }
        }
      }
    }

    // Start by removing the killed voxels from the living list and updating all the neighbours
    // to have one less living neighbour for the next iteration
    killedVoxels.forEach((killedVoxel) => this.death(killedVoxel));

    // Add the newly birthed voxels to the living list and update all the neighbours
    // to have one more living neighbour for the next iteration
    birthedVoxels.forEach((birthedVoxel) => this.birth(birthedVoxel));
  }

  birth(birthedVoxel) {
    const {aliveColour} = this.config;
    const {x,y,z} = birthedVoxel;

    this.addVoxelToAliveVoxels(birthedVoxel);
    this.voxels.drawPoint(new THREE.Vector3(x,y,z), aliveColour);
    this.neighbourIter(birthedVoxel, (centerVoxel, neighbourVoxel) => neighbourVoxel.numLivingNeighbours++);
    birthedVoxel.isAlive = true;
  }
  death(killedVoxel) {
    const {deadColour} = this.config;
    const {x,y,z} = killedVoxel;

    if (x in this.aliveVoxels && y in this.aliveVoxels[x] && z in this.aliveVoxels[x][y]) {
      delete this.aliveVoxels[x][y][z];
    }
    this.voxels.drawPoint(new THREE.Vector3(x,y,z), deadColour);
    this.neighbourIter(killedVoxel, (centerVoxel, neighbourVoxel) => neighbourVoxel.numLivingNeighbours--);
    killedVoxel.isAlive = false;
  }

  addVoxelToAliveVoxels(aliveVoxelStateObj) {
    const {x,y,z} = aliveVoxelStateObj;
    let currAliveVoxelsObj = this.aliveVoxels;

    if (!(x in currAliveVoxelsObj)) {
      currAliveVoxelsObj[x] = {};
    }
    currAliveVoxelsObj = currAliveVoxelsObj[x];

    if (!(y in currAliveVoxelsObj)) {
      currAliveVoxelsObj[y] = {};
    }
    currAliveVoxelsObj = currAliveVoxelsObj[y];

    currAliveVoxelsObj[z] = aliveVoxelStateObj;
  }

  neighbourIter(centerVoxel, iterFunc) {
    const VOXEL_X_SIZE = this.voxels.gridSize;
    const VOXEL_Y_SIZE = this.voxels.gridSize;
    const VOXEL_Z_SIZE = this.voxels.gridSize;

    const {x,y,z} = centerVoxel;

    // Go through the 26 (i.e., 3*3*3-1) possible neighbours and execute the given iterFunc on each
    for (let nX = Math.max(0, x-1); nX <= Math.min(VOXEL_X_SIZE-1, x+1); nX++) {
      for (let nY = Math.max(0, y-1); nY <= Math.min(VOXEL_Y_SIZE-1, y+1); nY++) {
        for (let nZ = Math.max(0, z-1); nZ <= Math.min(VOXEL_Z_SIZE-1, z+1); nZ++) {
          const neighbourVoxel = this.currState[nX][nY][nZ];
          if (centerVoxel !== neighbourVoxel) {
            iterFunc(centerVoxel, neighbourVoxel);
          }
        }
      }
    }
  }

}

export default GameOfLifeAnimator;