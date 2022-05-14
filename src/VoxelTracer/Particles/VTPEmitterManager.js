import InitUtils from "../../InitUtils";

import VTPParticle from "./VTPParticle";
import VTPool from '../VTPool';


class VTPEmitterManager {
  constructor(vtScene, preloadNum=0, preloadObjTypes=[]) {
    this.scene = vtScene;
    
    this.emitters = [];
    this.preloadNum = preloadNum;

    this.pool = new VTPool();

    this.pool.preload(this.preloadNum, VTPParticle);
    for (const objType of preloadObjTypes) {
      if (objType === VTPParticle) { continue; }
      this.pool.preload(this.preloadNum, objType);
    }
  }

  addEmitter(emitter) {
    this.emitters.push(emitter);
    emitter.parent = this;
    this.dispatchEvent("emitterAdded", emitter);
  }
  removeEmitter(emitter) {
    if (emitter.parent != this) return;
    this.emitters.splice(this.emitters.indexOf(emitter), 1);
    emitter.parent = null;
    this.dispatchEvent("emitterRemoved", emitter);
  }

  tick(dt) {
    for (const emitter of this.emitters) { emitter.tick(dt); }
  }

  dispatchEvent(eventName, ...args) { this[eventName](...args); }
  
  // Events
  emitterAdded(emitter) {}
  emitterRemoved(emitter) {}

  particleCreated(emitter, particle) {
    if (!particle.target) {
      particle.target = this.pool.get(particle.bodyType);
      if (!particle.target.material || !(particle.target.material instanceof particle.materialType)) {
        particle.target.setMaterial(InitUtils.classApply(particle.materialType));
      }
    }
    if (!emitter.blendParticles) {
      particle.target.drawOrder = emitter.cID + 1;
    }
    
    const {target, targetOptions} = particle;
    target.position.copy(particle.p);
    target.setOptions(targetOptions);
    
    this.scene.addObject(particle.target);
  }

  particleUpdate(emitter, particle) {
    if (!particle.target) { return; }

    const {target} = particle;
    target.setRadius(particle.radius);
    target.position.copy(particle.p);
    target.setRotationFromEuler(particle.rotation);
    target.scale.set(particle.scale, particle.scale, particle.scale);

    const {material} = target;
    if (particle.useAlpha)  { material.alpha = particle.alpha; }
    if (particle.useColour) { material.colour.copy(particle.colour); }
    (particle.useAlpha || particle.useColour) && target.setMaterial(material);
  }

  particleDead(emitter, particle) {
    if (!particle.target) { return; }
    this.pool.expire(particle.target);
    this.scene.removeObject(particle.target);
    particle.target = null;
  }

}

export default VTPEmitterManager;