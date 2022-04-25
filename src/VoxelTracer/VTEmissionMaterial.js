import * as THREE from 'three';

import VTMaterial from './VTMaterial';
import VTTexture from './VTTexture';
import {clamp} from '../MathUtils';

class VTEmissionMaterial extends VTMaterial {
  constructor(colour=new THREE.Color(1,1,1), alpha=1, texture=null) {
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

  isVisible() { return Math.round(this.alpha*255) >= 1; }

  emission(targetRGBA, uv) {
    targetRGBA.a = this.alpha;
    return this.albedo(targetRGBA, uv);
  }

  albedo(targetRGBA, uv) {
    targetRGBA.copy(this.colour);
    targetRGBA.a = this.alpha;
    if (uv && this.texture && this.texture.isLoaded()) {
      targetRGBA.multiply(this.texture.sample(uv));
    }
    return targetRGBA;
  }

  brdf(targetRGBA, nObjToLightVec, normal, uv, lightColour) {
    const dot = clamp(nObjToLightVec.dot(normal), 0, 1);
    this.brdfAmbient(targetRGBA, uv, lightColour);
    targetRGBA.multiplyScalar(dot); // Only multiply the rgb, not the alpha.
    return targetRGBA;
  }

  brdfAmbient(targetRGBA, uv, lightColour) {
    this.albedo(targetRGBA, uv);
    targetRGBA.add(lightColour);
    return targetRGBA;
  }

  basicBrdfAmbient(targetRGBA, uv, lightColour) { 
    return this.brdfAmbient(targetRGBA, uv, lightColour);
  }
}

export default VTEmissionMaterial;