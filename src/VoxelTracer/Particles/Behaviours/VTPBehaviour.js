import InitUtils from "../../../InitUtils";
import VTPEase from "../VTPEase";

// Abstract base class for all particle behaviours
class VTPBehaviour {
  constructor(life, easing) {
    this.life = InitUtils.initValue(life, Infinity);
    this.easing = InitUtils.initValue(easing, VTPEase.easeLinear);
    this.age = 0;
    this.energy = 1;
    this.dead = false;
  }

  reset(life, easing) {
    this.life = InitUtils.initValue(life, Infinity);
    this.easing = InitUtils.initValue(easing, VTPEase.easeLinear);
  }

  initialize(particle) {}

  applyBehaviour(particle, dt, index) {
    if (this.dead) { return; }
    
    this.age += dt;
    if (this.age >= this.life) {
      this.energy = 0;
      this.dead = true;
      return;
    }

    const scale = this.easing(particle.age / particle.life);
    this.energy = Math.max(1-scale, 0);
  }

  destroy() {}
}

export default VTPBehaviour;
