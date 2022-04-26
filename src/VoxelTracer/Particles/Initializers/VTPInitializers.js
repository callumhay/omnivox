import * as THREE from 'three';

import InitUtils from '../../../InitUtils';
import {Randomizer} from '../../../Randomizers';

import VTVoxel from "../../VTVoxel";
import VTEmissionMaterial from '../../VTEmissionMaterial';

import VTPUtils from "../VTPUtils";
import VTPSpan from "../VTPSpan";


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
  constructor(bodyType, materialType) {
    super();
    this.bodyType = InitUtils.initValue(bodyType, VTVoxel);
    this.materialType = InitUtils.initValue(materialType, VTEmissionMaterial);
  }
  initialize(target) {
    target.bodyType = this.bodyType;
    target.materialType = this.materialType;
  }
}

// Generator for a uniformly distributed unit vector on a sphere (i.e., a randomized 3D unit vector)
export class UniformSphereDirGenerator {
  constructor() {}
  generate(vec3) {
    const phi = Randomizer.getRandomFloat(0, 2*Math.PI);
    const theta = Math.acos(Randomizer.getRandomFloat(-1,1));
    vec3.setFromSphericalCoords(1, phi, theta);
    return vec3;
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
  generate(vec3) {
    vec3.copy(this._dirList[(this._dirList.length * Math.random()) >> 0]);
  }
}

export class VTPVelocity extends VTPInitializer {
  constructor(speedSpan, dirGenerator) {
    super();
    this.speedSpan = speedSpan;
    this.dirGenerator = dirGenerator;
  }
  initialize(target) {
    this.dirGenerator.generate(target.v);
    target.v.multiplyScalar(this.speedSpan.getValue());
  }
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
