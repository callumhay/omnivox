import * as THREE from 'three';
import chroma from 'chroma-js';

import VoxelConstants from './VoxelConstants';
import Spectrum, {COLOUR_INTERPOLATION_RGB} from './Spectrum';
import {clamp} from './MathUtils';
import InitUtils from './InitUtils';

// "Abstract" parent class for various random number generators
export class Randomizer {
  constructor() {
  }

  generate() {
    throw "Randomizer::generate is unimplemented because Randomizer is an abstract class, please use a child class.";
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
  static getRandomPositiveOrNegative() {
    return Math.random() > 0.5 ? 1 : -1;
  }

  static getRandomFloats(targetArray, min=0, max=1) {
    for (let i = 0, arrLen = targetArray.length; i < arrLen; i++) {
      targetArray[i] = Randomizer.getRandomFloat(min,max);
    }
    return targetArray;
  }

  static getRandomUnitVec(target) {
    const phi = Randomizer.getRandomFloat(0, 2*Math.PI);
    const theta = Math.acos(Randomizer.getRandomFloat(-1,1));
    target.setFromSphericalCoords(1, phi, theta);
    return target;
  }
}

/**
 * Generates random floating point numbers in the range [min,max).
 */
export class UniformFloatRandomizer extends Randomizer {
  constructor(min=0, max=0) {
    super();
    this.min = min;
    this.max = max;
  }
  set(min, max) {
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
  constructor(min, max) {
    super();
    this.min = min ? min.clone() : new THREE.Vector3();
    this.max = max ? max.clone() : new THREE.Vector3();
  }

  set(min, max) {
    this.min.copy(min);
    this.max.copy(max);
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
  constructor(baseDirection, radAngle) {
    super();
    this.baseDirection = baseDirection ? baseDirection.clone().normalize() : new THREE.Vector3(0,1,0);
    this.radAngle = radAngle ? radAngle : 0;
  }

  set(dir, radAngle) {
    this.baseDirection.copy(dir).normalize();
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
  constructor(min, max) {
    super();
    this.min = InitUtils.initTHREEColor(min,0,0,0);
    this.max = InitUtils.initTHREEColor(max,1,1,1);
  }

  set(min, max) {
    this.min.copy(min);
    this.max.copy(max);
  }

  generate(colourInterpolation=COLOUR_INTERPOLATION_RGB) {
    return ColourRandomizer.getRandomColour(this.min, this.max, colourInterpolation);
  }

  static getRandomColour(minColour, maxColour, colourInterpolation) {
    return new THREE.Color(chroma.mix(minColour.getHex(), maxColour.getHex(), Randomizer.getRandomIntInclusive(0,1000)/1000, colourInterpolation).hex());
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

export class RandomHighLowColourCycler {
  constructor(config=RandomHighLowColourCycler.randomColourCyclerDefaultConfig) {
    this.reset();
    this.setConfig(config);
  }

  static get randomColourCyclerDefaultConfig() {
    return {
      randomColourHoldTime: 5,
      randomColourTransitionTime: 2,
    };
  }

  setConfig(c) {
    this.config = c;
  }
  reset() {
    this.colourTransitionTimeCounter = 0;
    this.colourHoldTimeCounter = 0;
    this.currRandomColours = Spectrum.genRandomHighLowColours();
    this.prevRandomColours = this.currRandomColours;
    this.nextRandomColours = Spectrum.genRandomHighLowColours(this.currRandomColours);
  }

  isTransitioning() {
    const {randomColourHoldTime} = this.config;
    return this.colourHoldTimeCounter >= randomColourHoldTime;
  }

  tick(dt, colourInterpolationType) {
    const {randomColourTransitionTime} = this.config;

    if (this.isTransitioning()) {
      // We're transitioning between random colours, interpolate from the previous to the next
      const interpolationVal = clamp(this.colourTransitionTimeCounter / randomColourTransitionTime, 0, 1);

      const {lowTempColour:currLowTC, highTempColour:currHighTC} = this.prevRandomColours;
      const {lowTempColour:nextLowTC, highTempColour:nextHighTC} = this.nextRandomColours;

      const finalLowTempColour  = new THREE.Color(chroma.mix(currLowTC.getHex(), nextLowTC.getHex(), interpolationVal, colourInterpolationType).hex());
      const finalHighTempColour = new THREE.Color(chroma.mix(currHighTC.getHex(), nextHighTC.getHex(), interpolationVal, colourInterpolationType).hex());

      this.colourTransitionTimeCounter += dt;
      this.currRandomColours = {lowTempColour: finalLowTempColour, highTempColour: finalHighTempColour};

      if (interpolationVal >= 1) {
        this.prevRandomColours = this.currRandomColours;
        this.nextRandomColours = Spectrum.genRandomHighLowColours(this.currRandomColours);
        this.colourTransitionTimeCounter = 0;
        this.colourHoldTimeCounter = 0;
      }
    }
    else {
      this.colourHoldTimeCounter += dt;
    }

    return this.currRandomColours;
  }
}
