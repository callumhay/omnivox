import * as THREE from 'three';
import {clamp} from '../MathUtils';

class VTLambertMaterial {
  constructor(colour, texture=null) {
    this.colour = colour ? colour : new THREE.Color(1,1,1);
    this.texture = texture;
  }

  dispose() {}

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
    albedoColour.multiply(lightColour);
    return albedoColour;
  }
}

export default VTLambertMaterial;