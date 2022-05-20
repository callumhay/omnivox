import InitUtils from '../InitUtils';
import {clamp} from '../MathUtils';

import VTMaterial from './VTMaterial';

class VTEmissionMaterial extends VTMaterial {
  constructor(colour, alpha) {
    super(VTMaterial.EMISSION_TYPE);
    this.colour = InitUtils.initTHREEColor(colour);
    this.alpha  = InitUtils.initValue(alpha, 1);
  }

  setColour(c) { this.colour.copy(c); return this; }

  expire(pool) {}

  fromJSON(json, pool) {
    const {colour, alpha} = json;
    this.colour.setHex(colour);
    this.alpha = alpha;
    return this;
  }
  toJSON() {
    const {type, colour, alpha} = this;
    return {type, colour, alpha};
  }

  isEmissionOnly() { return true; }

  isVisible() { return Math.round(this.alpha*255) >= 1; }

  emission(targetRGBA, uv) {
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
    this.albedo(targetRGBA, uv);
    targetRGBA.add(lightColour);
    targetRGBA.multiplyScalar(dot); // Only multiply the rgb, not the alpha.
    return targetRGBA;
  }

  brdfAmbient(targetRGBA, uv, lightColour) {
    return targetRGBA;
    //this.albedo(targetRGBA, uv);
    //targetRGBA.add(lightColour);
    //return targetRGBA;
  }

  basicBrdfAmbient(targetRGBA, uv, lightColour) { 
    return targetRGBA; // Ambient lighting should not affect an emissive colour
    //return this.brdfAmbient(targetRGBA, uv, lightColour);
  }
}

export default VTEmissionMaterial;