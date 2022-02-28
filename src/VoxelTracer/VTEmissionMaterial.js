import * as THREE from 'three';

import VTMaterial from './VTMaterial';
import VTTexture from './VTTexture';
import {clamp} from '../MathUtils';

class VTEmissionMaterial extends VTMaterial {
  constructor(colour, alpha=1, texture=null) {
    super(VTMaterial.EMISSION_TYPE);
    this.colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this.alpha = alpha;
    this.texture = texture;
  }

  static build(jsonData) {
    const {colour, alpha, texture} = jsonData;
    const threeColour = (new THREE.Color()).setHex(colour);
    return new VTEmissionMaterial(threeColour, alpha, VTTexture.build(texture));
  }

  dispose() {}

  toJSON() {
    const {type, colour, alpha, texture} = this;
    return {type, colour, alpha, texture};
  }

  emission(uv) {
    return this.albedo(uv).multiplyScalar(this.alpha);
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