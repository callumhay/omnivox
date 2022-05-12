import * as THREE from 'three';

import InitUtils from '../../../InitUtils';

import VTPSpan from '../VTPSpan';

import VTPBehaviour from "./VTPBehaviour";

class VTPAlpha extends VTPBehaviour {
  constructor(startAlpha, endAlpha, life, easing) {
    super(life, easing);
    this.reset(startAlpha, endAlpha);
  }

  reset(startAlpha, endAlpha, life=null, easing=null) {
    super.reset(life, easing);
    this._same = (endAlpha == null || endAlpha == undefined);
    this.startAlpha = VTPSpan.createSpan(InitUtils.initValue(startAlpha, 1));
    this.endAlpha   = VTPSpan.createSpan(endAlpha);
  }

  initialize(particle) {
    particle.useAlpha = true;
    particle.transform.alphaStart = this.startAlpha.getValue();
    particle.transform.alphaEnd   = this._same ? particle.transform.alphaStart : this.endAlpha.getValue();
  }

  applyBehaviour(particle, dt, index) {
    super.applyBehaviour(particle, dt, index);
    particle.alpha = THREE.MathUtils.lerp(particle.transform.alphaEnd, particle.transform.alphaStart, this.energy);
    if (particle.alpha < 0.002) { particle.alpha = 0; }
  }
}

export default VTPAlpha;
