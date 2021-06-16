import * as THREE from 'three';

import VTMaterial from './VTMaterial';
import VTTexture from './VTTexture';
import {clamp} from '../MathUtils';

class VTLambertMaterial extends VTMaterial {
  constructor(colour = new THREE.Color(1,1,1), emissive = new THREE.Color(0,0,0), alpha=1, texture=null, reflect=false) {
    super(VTMaterial.LAMBERT_TYPE);
    this.colour = colour instanceof THREE.Color ? colour : new THREE.Color(colour.r, colour.g, colour.b);
    this.emissive = emissive instanceof THREE.Color ? emissive : new THREE.Color(emissive.r, emissive.g, emissive.b);
    this.alpha = alpha;
    this.texture = texture;
    this.reflect = reflect;
  }

  static build(jsonData) {
    const {colour, emissive, alpha, texture, reflect} = jsonData;
    const threeColour = (new THREE.Color()).setHex(colour);
    const threeEmission = (new THREE.Color()).setHex(emissive);
    return new VTLambertMaterial(threeColour, threeEmission, alpha, VTTexture.build(texture), reflect);
  }

  dispose() {}

  toJSON() {
    const {type, colour, emissive, alpha, texture, reflect} = this;
    return {type, colour, emissive, alpha, texture, reflect};
  }

  isVisible() {
    return Math.round(this.alpha*255) >= 1;
  }

  emission(uv) {
    return this.emissive.clone();
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