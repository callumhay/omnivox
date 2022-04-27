import * as THREE from 'three';

import InitUtils from '../InitUtils';
import {clamp} from '../MathUtils';

import VTMaterial from './VTMaterial';
//import VTTexture from './VTTexture';

class VTEmissionMaterial extends VTMaterial {
  constructor(colour, alpha=1) {
    super(VTMaterial.EMISSION_TYPE);
    this.colour = InitUtils.initTHREEColor(colour);
    this.alpha = alpha;
    //this.texture = texture;
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {colour, alpha} = json;
    this.colour.setHex(colour);
    this.alpha = alpha;
    return this;
  }

  static build(jsonData) {
    const {colour, alpha} = jsonData;
    const threeColour = (new THREE.Color()).setHex(colour);
    return new VTEmissionMaterial(threeColour, alpha);//, VTTexture.build(texture));
  }

  toJSON() {
    const {type, colour, alpha} = this;
    return {type, colour, alpha};
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