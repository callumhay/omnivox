
import * as THREE from 'three';

class VTAmbientLight {
  constructor(colour=new THREE.Color(0,0,0)) {
    this.colour = colour;
  }

  dispose() {}

  emission(distance) {
    return this.colour.clone();
  }
};

export default VTAmbientLight;