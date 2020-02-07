import * as THREE from 'three';

class Randomizer {
  constructor() {
  }

  generate() {}

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

  generate() {
    return min + Math.random() * (max - min);
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
  contructor(baseDirection = new THREE.Vector3(1,0,0), radAngleMin = 0, radAngleMax = Math.PI) {
    super();
    this.baseDirection = baseDirection.clone().normalize();
    this.radAngleMin = radAngleMin;
    this.radAngleMax = radAngleMax;
  }
  generate() {
    // Get a random angle to rotate by
    const randAngleInRads = THREE.MathUtils.randFloat(this.radAngleMin, this.radAngleMax);
    const spherical = new THREE.Spherical().setFromVector3(this.baseDirection);
    
    spherical.phi += randAngleInRads;
    spherical.theta += randAngleInRads;
    spherical.makeSafe();

    return new THREE.Vector3().setFromSpherical(spherical);
  }
}

export class ColourRandomizer extends Randomizer {
  constructor(min = new THREE.Color(0,0,0), max = new THREE.Color(1,1,1)) {
    super();

    const minHSL = min.getHSL();
    const maxHSL = max.getHSL();

    this.hRandomizer = new UniformIntRandomizer(Math.floor(255*minHSL.h), Math.floor(255*maxHSL.h), false);
    this.sRandomizer = new UniformIntRandomizer(Math.floor(255*minHSL.s), Math.floor(255*maxHSL.s), false);
    this.lRandomizer = new UniformIntRandomizer(Math.floor(255*minHSL.l), Math.floor(255*maxHSL.l), false);
  }

  generate() {
    const colour = new THREE.Color();
    colour.setHSL(
      this.hRandomizer.generate() / 255.0, 
      this.sRandomizer.generate() / 255.0, 
      this.lRandomizer.generate() / 255.0
    );

    return colour;
  }
}

