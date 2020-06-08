import * as THREE from 'three';
import {clamp} from '../MathUtils';

class VTEmissionMaterial {
  constructor(colour, alpha=1, texture=null) {
    this.colour = colour;
    this.alpha = alpha;
    this.texture = texture;
  }

  dispose() {}

  emission(uv) {
    return this.albedo(uv);
  }

  isVisible() {
    return Math.round(this.alpha*255) >= 1;
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
    const albedoColour = this.albedo(uv);
    albedoColour.add(lightColour).multiplyScalar(this.alpha);
    return albedoColour;
  }
}

export default VTEmissionMaterial;