import * as THREE from 'three';
import {clamp} from '../MathUtils';

class VTLambertMaterial {
  constructor(colour, alpha=1, texture=null, reflect=false) {
    this.colour = colour;
    this.alpha = alpha;
    this.texture = texture;
    this.reflect = reflect;
  }

  dispose() {}

  isVisible() {
    return Math.round(this.alpha*255) >= 1;
  }

  emission(uv) {
    return new THREE.Color(0,0,0);
  }

  albedo(uv) {
    const albedoColour = this.colour.clone();
    if (uv && this.texture && this.texture.isLoaded()) {
      albedoColour.multiply(this.texture.sample(uv));
    }
    return albedoColour;
  }

  brdf(nObjToLightVec, normal, uv, lightColour) {
    const dot = clamp(nObjToLightVec.dot(normal), 0, 1);
    return this.brdfAmbient(uv, lightColour).multiplyScalar(dot);
  }

  brdfAmbient(uv, lightColour) {
    return this.reflect ? this._reflectiveBrdfAmbient(uv, lightColour) : this.basicBrdfAmbient(uv, lightColour);
  }

  basicBrdfAmbient(uv, lightColour) {
    const albedoColour = this.albedo(uv);
    albedoColour.multiply(lightColour).multiplyScalar(this.alpha);
    return albedoColour;
  }
  _reflectiveBrdfAmbient(uv, lightColour) {
    const albedoColour = this.albedo(uv);
    albedoColour.add(lightColour).multiply(lightColour).multiplyScalar(this.alpha);
    return albedoColour;
  }
}

export default VTLambertMaterial;