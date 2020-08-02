import * as THREE from 'three';
import chroma from 'chroma-js';

import VoxelConstants from '../VoxelConstants';

export class Randomizer {
  constructor() {
  }

  generate() {
  }
  static getRandomFloat(min, max) {
    return THREE.MathUtils.randFloat(min, max);
  }
  static getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
  }
  static getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; // The maximum is inclusive and the minimum is inclusive 
  }

  static getRandomFloats(size, min=0, max=1) {
    let result = new Array(size);
    for (let i = 0; i < size; i++) {
      result[i] = Randomizer.getRandomFloat(min,max);
    }
    return result;
  }
}

/**
 * Generates random floating point numbers in the range [min,max).
 */
export class UniformFloatRandomizer extends Randomizer {
  constructor(min = 0.0, max = 1.0) {
    super();
    this.min = min;
    this.max = max;
  }

  get average() {
    return (this.min + this.max) / 2.0;
  }

  generate() {
    return Randomizer.getRandomFloat(this.min, this.max);
  }
}

/**
 * Generates random integer numbers in the range [min,max) or [min,max] given
 * the value of the "isMaxExclusive" option.
 */
export class UniformIntRandomizer extends Randomizer {
  constructor(min = 0, max = 1, isMaxExclusive = true) {
    super();
    this.min = min;
    this.max = max;
    this.isMaxExclusive = isMaxExclusive;
  }

  get average() {
    return (this.min + this.max) / 2.0;
  }

  generate() {
    return this.isMaxExclusive ? 
      Randomizer.getRandomInt(this.min, this.max) :
      Randomizer.getRandomIntInclusive(this.min, this.max);
  }
}

/**
 * Chooses a uniform random element from the given array/set.
 */
export class UniformSetRandomizer extends Randomizer {
  constructor(possibleVals = []) {
    this.possibleVals = possibleVals;
  }
  generate() {
    return this.possibleVals[Randomizer.getRandomInt(0,this.possibleVals.length)];
  }
}

export class UniformVector3Randomizer extends Randomizer {
  constructor(min = new THREE.Vector3(0,0,0), max = new THREE.Vector3(1,1,1)) {
    super();
    this.min = min.clone();
    this.max = max.clone();
  }
  generate() {
    return new THREE.Vector3(
      THREE.MathUtils.randFloat(this.min.x, this.max.x),
      THREE.MathUtils.randFloat(this.min.y, this.max.y),
      THREE.MathUtils.randFloat(this.min.z, this.max.z)
    );
  }
}

export class Vector3DirectionRandomizer extends Randomizer {
  constructor(baseDirection, radAngle = 0) {
    super();
    this.baseDirection = baseDirection.clone().normalize();
    this.radAngle = radAngle;
  }

  generate() {
    // Generate points on the spherical cap around the north pole.
    // See https://math.stackexchange.com/a/205589/81266
    const z = THREE.MathUtils.randFloat(0,1) * (1 - Math.cos(this.radAngle)) + Math.cos(this.radAngle);
    const phi = THREE.MathUtils.randFloat(0,1) *  2 * Math.PI;
    const x = Math.sqrt(1-z*z)*Math.cos(phi);
    const y = Math.sqrt(1-z*z)*Math.sin(phi);
    
    const zVec = new THREE.Vector3(0,0,1);
    const result = new THREE.Vector3(x, y, z);

    // If the spherical cap is centered around the north pole, we're done
    if (this.baseDirection.distanceToSquared(zVec) < VoxelConstants.VOXEL_EPSILON) {
      return result;
    }

    // Otherwise we need to get a perpendicular rotation axis 'u' and rotation angle 'rot'
    const u = new THREE.Vector3();
    u.crossVectors(zVec, this.baseDirection);
    const rot = Math.acos(this.baseDirection.dot(zVec));
    
    // Convert rotation axis and angle to a rotation matrix
    const R = new THREE.Matrix4();
    R.makeRotationAxis(u, rot);
    
    return result.applyMatrix4(R);
  }
}

export class ColourRandomizer extends Randomizer {
  constructor(min = new THREE.Color(0,0,0), max = new THREE.Color(1,1,1)) {
    super();
    this.min = min;
    this.max = max;
  }

  generate() {
    const temp = chroma.mix(chroma.gl(this.min), chroma.gl(this.max), Randomizer.getRandomIntInclusive(0,1000)/1000).gl();
    return new THREE.Color(temp[0], temp[1], temp[2]);
  }

  toJSON() {
    return {
      min: {r: this.min.r, g: this.min.g, b: this.min.b}, 
      max: {r: this.max.r, g: this.max.g, b: this.max.b}
    };
  }

  toString() {
    return "min: (" + this.min.r + ", " + this.min.g + ", " + this.min.b + "), max: (" + this.max.r + ", " + this.max.g + ", " + this.max.b + ")";
  }

}

