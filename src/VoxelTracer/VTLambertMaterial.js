import * as THREE from 'three';

import InitUtils from '../InitUtils';
import {clamp} from '../MathUtils';

//import VTTexture from './VTTexture';
import VTMaterial from './VTMaterial';

class VTLambertMaterial extends VTMaterial {
  constructor(colour=new THREE.Color(1,1,1), emissive=new THREE.Color(0,0,0), alpha=1) {
    super(VTMaterial.LAMBERT_TYPE);
    this.colour = InitUtils.initTHREEColor(colour);
    this.emissive = InitUtils.initTHREEColor(emissive);
    this.alpha = alpha;
    //this.texture = texture;
  }

  expire(pool) {}

  fromJSON(json, pool) {
    const {colour, emissive, alpha} = json;
    this.colour.setHex(colour);
    this.emissive.setHex(emissive);
    this.alpha = alpha;
    return this;
  }

  static build(jsonData) {
    const {colour, emissive, alpha} = jsonData;
    const threeColour = (new THREE.Color()).setHex(colour);
    const threeEmission = (new THREE.Color()).setHex(emissive);
    return new VTLambertMaterial(threeColour, threeEmission, alpha);//, VTTexture.build(texture));
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