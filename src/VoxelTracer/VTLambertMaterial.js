import * as THREE from 'three';
import {clamp} from '../MathUtils';

class VTLambertMaterial {
  constructor(colour) {
    this.colour = colour ? colour : new THREE.Color(1,1,1);
  }

  brdf(nObjToLightVec, normalVec, lightColour) {
    const result = this.colour.clone().multiply(lightColour);
    const dot = clamp(nObjToLightVec.dot(normalVec), 0, 1);
    return result.multiplyScalar(dot);
  }
}

export default VTLambertMaterial;