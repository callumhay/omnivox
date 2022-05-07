import InitUtils from '../InitUtils';
import {clamp} from '../MathUtils';

import VTMaterial from './VTMaterial';

class VTLambertMaterial extends VTMaterial {
  constructor(colour, emissive, alpha) {
    super(VTMaterial.LAMBERT_TYPE);

    this.colour   = InitUtils.initTHREEColor(colour, 1, 1, 1);
    this.emissive = InitUtils.initTHREEColor(emissive, 0, 0, 0);
    this.alpha    = InitUtils.initValue(alpha, 1);
  }

  setColour(c) { this.colour.copy(c); return this; }
  setEmissive(e) { this.emissive.copy(e); return this; }
  setAlpha(a) { this.alpha = a; return this; }

  expire(pool) {}

  fromJSON(json, pool) {
    const {colour, emissive, alpha} = json;
    this.colour.setHex(colour);
    this.emissive.setHex(emissive);
    this.alpha = alpha;
    return this;
  }
  toJSON() {
    const {type, colour, emissive, alpha} = this;
    return {type, colour, emissive, alpha};
  }

  isVisible() {
    return Math.round(this.alpha*255) >= 1;
  }

  emission(targetRGBA, uv) {
    targetRGBA.a = this.alpha;
    return targetRGBA.copy(this.emissive);
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
    return this.brdfAmbient(targetRGBA, uv, lightColour).multiplyScalar(dot);
  }

  brdfAmbient(targetRGBA, uv, lightColour) {
    return this.basicBrdfAmbient(targetRGBA, uv, lightColour);
  }

  basicBrdfAmbient(targetRGBA, uv, lightColour) {
    this.albedo(targetRGBA, uv);
    targetRGBA.multiply(lightColour);
    return targetRGBA;
  }
}

export default VTLambertMaterial;