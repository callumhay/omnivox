import * as THREE from 'three';

import VTMaterial from './VTMaterial';
import VTTexture from './VTTexture';
import {clamp} from '../MathUtils';

class VTLambertMaterial extends VTMaterial {
  constructor(colour, alpha=1, texture=null, reflect=false) {
    super(VTMaterial.LAMBERT_TYPE);
    this.colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this.alpha = alpha;
    this.texture = texture;
    this.reflect = reflect;
  }

  static build(jsonData) {
    const {colour, alpha, texture, reflect} = jsonData;
    const threeColour = (new THREE.Color()).setHex(colour);
    return new VTLambertMaterial(threeColour, alpha, VTTexture.build(texture), reflect);
  }

  dispose() {}

  toJSON() {
    const {type, colour, alpha, texture, reflect} = this;
    return {type, colour, alpha, texture, reflect};
  }

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