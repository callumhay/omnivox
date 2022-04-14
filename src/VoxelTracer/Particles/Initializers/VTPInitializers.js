import * as THREE from 'three';

import VTPUtils from "../VTPUtils";
import VTPSpan from "../VTPSpan";
import VTVoxel from "../../VTVoxel";

import { Randomizer } from '../../../Randomizers';
import VTEmissionMaterial from '../../VTEmissionMaterial';

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
    this.bodyType = VTPUtils.initValue(bodyType, VTVoxel);
    this.materialType = VTPUtils.initValue(materialType, VTEmissionMaterial);
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
