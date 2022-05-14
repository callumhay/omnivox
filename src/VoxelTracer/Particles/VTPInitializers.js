import * as THREE from 'three';

import InitUtils from '../../InitUtils';
import {Randomizer} from '../../Randomizers';
import {perpendicularUnitVector, PI2} from '../../MathUtils';

import VTVoxel from "../VTVoxel";
import VTEmissionMaterial from '../VTEmissionMaterial';

import VTPUtils from "./VTPUtils";
import VTPSpan from "./VTPSpan";
import { VTPPointZone } from './VTPZones';


// Abstract base class for initializers
export class VTPInitializer {
  constructor() {}

  init(emitter, particle) {
    if (particle) { this.initialize(particle); } 
    else { this.initialize(emitter); }
  }

  initialize(target) { console.error("initialize unimplemented abstract method called."); }

  static setupInitializers(emitter, particle, initializers) {
    for (const initializer of initializers) {
      if (initializer instanceof VTPInitializer) { initializer.init(emitter, particle); }
      else { 
        VTPUtils.setObjectFromOptions(particle, initializer);
        VTPUtils.setVectorsFromOptions(particle, initializer);
      }
    }

    if (emitter.bindEmitter) {
      particle.p.add(emitter.p);
      particle.v.add(emitter.v);
      particle.a.add(emitter.a);
      particle.v.applyEuler(emitter.rotation);
    }
  }
}

export class VTPMass extends VTPInitializer {
  constructor(minMass, maxMass) {
    super();
    this.massSpan = VTPSpan.createSpan(minMass, maxMass);
  }
  initialize(target) { target.mass = this.massSpan.getValue(); }
}

export class VTPLife extends VTPInitializer {
  constructor(minLifeInSecs, maxLifeInSecs) {
    super();
    this.lifeSpan = VTPSpan.createSpan(minLifeInSecs, maxLifeInSecs);
  }
  initialize(target) { target.life = (this.lifeSpan.a === Infinity) ? Infinity : this.lifeSpan.getValue(); }
}

export class VTPBody extends VTPInitializer {
  constructor(bodyType, materialType, bodyOptions) {
    super();
    this.bodyType = InitUtils.initValue(bodyType, VTVoxel);
    this.materialType = InitUtils.initValue(materialType, VTEmissionMaterial);
    this.bodyOptions = InitUtils.initValue(bodyOptions, {});
  }
  initialize(target) {
    target.bodyType = this.bodyType;
    target.materialType = this.materialType;
    target.targetOptions = this.bodyOptions;
  }
}

// Generator for a uniformly distributed unit vector on a sphere (i.e., a randomized 3D unit vector)
export class UniformSphereDirGenerator {
  constructor() {}
  generate(target) {
    const phi = Randomizer.getRandomFloat(0, 2*Math.PI);
    const theta = Math.acos(Randomizer.getRandomFloat(-1,1));
    target.setFromSphericalCoords(1, phi, theta);
    return target;
  }
}
// Generator for a uniformly distributed vector in a cone shape based on a given direction (cone center vector) 
// and the half angle of the cone in radians
const _tempVec3 = new THREE.Vector3();
export class UniformConeDirGenerator {
  constructor(direction, halfAngle) {
    this.direction = InitUtils.initTHREEVector3(direction,0,1,0).normalize();
    this.halfAngle = InitUtils.initValue(halfAngle, Math.PI/8);
  }
  generate(target) {
    perpendicularUnitVector(_tempVec3, this.direction);
    // Rotate the perpendicular vector arbitrarily around the direction vector
    _tempVec3.applyAxisAngle(this.direction, Randomizer.getRandomFloat(0, PI2));
    target.copy(this.direction).applyAxisAngle(_tempVec3, Randomizer.getRandomFloat(0, this.halfAngle));
    return target;
  }
}

// Produces a random direction from a pre-defined list of static directions
export class StaticDirGenerator {
  constructor(dirList) {
    this._dirList = dirList.map(d => {
      if (d instanceof THREE.Vector3) { return d.normalize(); }
      else if (Array.isArray(d) && d.length >= 3) { return (new THREE.Vector3(d[0], d[1], d[2])).normalize(); }
      return (new THREE.Vector3(d.x, d.y, d.z)).normalize();
    });
  }
  generate(target) {
    target.copy(this._dirList[(this._dirList.length * Math.random()) >> 0]);
    return target;
  }
}

export class VTPVelocity extends VTPInitializer {
  constructor(speedSpan, dirGenerator) {
    super();
    this.speedSpan = VTPSpan.createSpan(speedSpan);
    this.dirGenerator = InitUtils.initValue(dirGenerator, null);
  }
  initialize(target) {
    this.dirGenerator.generate(target.v);
    target.v.multiplyScalar(this.speedSpan.getValue());
  }
}

export class VTPPosition extends VTPInitializer {
  constructor(zone) {
    super();
    this.zone = InitUtils.initValue(zone, new VTPPointZone());
  }
  initialize(target) { this.zone.getPosition(target.p); }
}

export class VTPRadius extends VTPInitializer {
  constructor(minRadius, maxRadius) {
    super();
    this.radiusSpan = VTPSpan.createSpan(minRadius, maxRadius);
  }
  initialize(target) { 
    target.radius = this.radiusSpan.getValue();
    target.transform.oldRadius = target.radius;
  }
}
