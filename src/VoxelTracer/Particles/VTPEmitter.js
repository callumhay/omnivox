import {VTPInitializer} from "./Initializers/VTPInitializers";
import VTPParticle from "./VTPParticle";
import VTPRate from "./VTPRate";
import VTPUtils from "./VTPUtils";

export const defaultRenderOptions = {
  castsShadow: false,
  receivesShadow: false
};

export const EMIT_ONCE = "once";
export const EMIT_NONE = "none";

class VTPEmitter extends VTPParticle {
  constructor(options) {
    super(options);

    this.damping = 0.006; // The friction coefficient for all particles emitted this
    this.bindEmitter = true; // Binds all particles output by this emitter to the transform of this emitter
    this.rate = new VTPRate(1, 0.1);
    this.blendParticles = false;

    this._initializers = [];
    this._particles    = [];
    this._behaviours   = [];

    this.currentEmitTime = 0;
    this.totalEmitTimes  = -1;
    this.cID = 0;
  }

  addInitializer() {
    let i = arguments.length;
    while (i--) { this._initializers.push(arguments[i]); }
  }
  removeInitializer(initializer) {
    const idx = this._initializers.indexOf(initializer);
    if (idx > -1) { this._initializers.splice(idx, 1); }
  }
  removeAllInitializers() { this._initializers.length = 0; }


  /**
   * Start/Initialize the emitter.
   * @method emit
   * @param {Number} totalEmitTimes total emit times;
   * @param {String} life the life of this emitter
   */
  emit(totalEmitTimes, life) {
    this.currentEmitTime = 0;
    this.totalEmitTimes = VTPUtils.initValue(totalEmitTimes, Infinity);

    if (life === true || life === 'life' || life === 'destroy') {
      this.life = totalEmitTimes == EMIT_ONCE ? 1 : this.totalEmitTimes;
    } 
    else if (!isNaN(life)) {
      this.life = life;
    }
    this.rate.init();
  }

  stopEmit() {
    this.totalEmitTimes = -1;
    this.currentEmitTime = 0;
  }

  removeAllParticles() {
    for (const particle of this._particles) { particle.dead = true; }
  }

  createParticle(initialize, behaviour) {
    const particle = this.parent.pool.get(VTPParticle);
    this.setupParticle(particle, initialize, behaviour);
    this.parent.dispatchEvent("particleCreated", this, particle);
    return particle;
  }

  integrate(dt) {
    const damping = 1 - this.damping;
    VTPUtils.eulerIntegrate(this, dt, damping);
    for (let i = 0; i < this._particles.length; i++) {
      const particle = this._particles[i];
      particle.update(dt, i);
      VTPUtils.eulerIntegrate(particle, dt, damping);
      this.parent.dispatchEvent("particleUpdate", this, particle);
    }
  }

  emitting(dt) {
    if (this.totalEmitTimes === EMIT_ONCE) {
      let i = this.rate.getValue(99999);
      if (i > 0) { this.cID = i; }
      while (i--) { this.createParticle(); }
      this.totalEmitTimes = EMIT_NONE;
    } 
    else if (!isNaN(this.totalEmitTimes)) {
      this.currentEmitTime += dt;
      if (this.currentEmitTime < this.totalEmitTimes) {
        let i = this.rate.getValue(dt);
        if (i > 0) { this.cID = i; }
        while (i--) { this.createParticle(); }
      }
    }
  }

  tick(dt) {
    this.age += dt;
    if (this.dead || this.age >= this.life) {
      this.destroy();
    }

    this.emitting(dt);
    this.integrate(dt);

    let particle = null, i = this._particles.length;
    while (i--) {
      particle = this._particles[i];
      if (particle.dead) {
        this.parent.dispatchEvent("particleDead", this, particle);
        this.parent.pool.expire(particle.reset());
        this._particles.splice(i, 1);
      }
    }
  }

  setupParticle(particle, initializer, behaviour) {
    let initializers = this._initializers;
    let behaviours = this._behaviours;

    if (initializer) { initializers = Array.isArray(initializer) ? initializer : [initializer]; }
    if (behaviour) { behaviours = Array.isArray(behaviour) ? behaviour : [behaviour]; }

    VTPInitializer.setupInitializers(this, particle, initializers);
    for (const b of behaviours) { particle.addBehaviour(b); }
    particle.parent = this;
    this._particles.push(particle);
  }

  destroy() {
    this.dead = true;
    this.energy = 0;
    this.totalEmitTimes = -1;

    if (this._particles.length == 0) {
      this.removeInitializers();
      this.removeAllBehaviours();
      this.parent && this.parent.removeEmitter(this);
    }
  }

}

export default VTPEmitter;
