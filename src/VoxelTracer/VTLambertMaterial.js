import * as THREE from 'three';
import {clamp} from '../MathUtils';

class VTLambertMaterial {
  constructor(colour, alpha=1, texture=null, reflect=false) {
    this.colour = colour ? colour : new THREE.Color(1,1,1);
    this.alpha = alpha;
    this.texture = texture;

    this.brdfAmbient = reflect ? this._reflectiveBrdfAmbient : this.basicBrdfAmbient;
  }

  dispose() {}

  isVisible() {
    return Math.round(this.alpha*255) >= 1;
  }

  albedo(uv) {
    const albedoColour = this.colour.clone().multiplyScalar(this.alpha);
    if (uv && this.texture && this.texture.isLoaded()) {
      albedoColour.multiply(this.texture.sample(uv));
    }
    return albedoColour;
  }

  brdf(nObjToLightVec, normal, uv, lightColour) {
    const dot = clamp(nObjToLightVec.dot(normal), 0, 1);
    return this.brdfAmbient(uv, lightColour).multiplyScalar(dot);
  }

  basicBrdfAmbient(uv, lightColour) {
    const albedoColour = this.albedo(uv);
    albedoColour.multiply(lightColour);
    return albedoColour;
  }
  _reflectiveBrdfAmbient(uv, lightColour) {
    const albedoColour = this.albedo(uv);
    albedoColour.add(lightColour).multiply(lightColour);
    return albedoColour;
  }
}

export default VTLambertMaterial;