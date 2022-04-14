import * as THREE from 'three';
import VTVoxel from '../VTVoxel';
import VTPUtils from './VTPUtils';
import VTPEase from './VTPEase';
import VTEmissionMaterial from '../VTEmissionMaterial';

class VTPParticle {
  constructor(options) {

    this.reset(true);
    VTPUtils.setObjectFromOptions(this, options);
  }

  reset(init) {
    this.life = Infinity;
    this.age = 0;
    this.energy = 1;
    this.dead = false;
    this.sleep = false;
    this.bodyType = VTVoxel;
    this.materialType = VTEmissionMaterial;
    this.target = null;
    this.parent = null;
    this.mass = 1;
    this.radius = 1;

    this.alpha = 1;
    this.scale = 1;

    this.useColour = false;
    this.useAlpha = false;

    this.easing = VTPEase.easeLinear;

    if (init) {
      this.p = new THREE.Vector3();
      this.v = new THREE.Vector3();
      this.a = new THREE.Vector3();
      this.old = {
        p: this.p.clone(),
        v: this.v.clone(),
        a: this.a.clone(),
      };

      this._behaviours = [];
      this.transform = {};
      this.colour   = new THREE.Color(0,0,0);
      this.rotation = new THREE.Euler(0,0,0);
    } 
    else {
      this.p.set(0, 0, 0); this.v.set(0, 0, 0); this.a.set(0, 0, 0);
      this.old.p.set(0, 0, 0); this.old.v.set(0, 0, 0); this.old.a.set(0, 0, 0);
      this.colour.setRGB(0,0,0);
      this.rotation.set(0,0,0);
      this.transform = {};
      this.removeAllBehaviours();
    }

    return this;
  }

  addBehaviour(behaviour) { 
    this._behaviours.push(behaviour);
    behaviour.initialize(this);
  }
  removeBehaviour(behaviour) {
    const idx = this._behaviours.indexOf(behaviour);
    if (idx > -1) { this._behaviours.splice(idx, 1); }
  }
  removeAllBehaviours() { this._behaviours.length = 0; }

  update(dt, index) {
    if (!this.sleep) {
      this.age += dt;
      for (const behaviour of this._behaviours) {
        behaviour.applyBehaviour(this, dt, index);
      }
    }

    if (this.age >= this.life) { this.destroy(); } 
    else {
      const scale = this.easing(this.age / this.life);
      this.energy = Math.max(1 - scale, 0);
    }
  }

  destroy() {
    this.removeAllBehaviours();
    this.energy = 0;
    this.dead = true;
    this.parent = null;
  }
}

export default VTPParticle;