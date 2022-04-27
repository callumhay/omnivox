import * as THREE from 'three';

class VTRPSample {
  constructor() {
    this.point = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.uv = null;
    this.falloff = 1;
  }

  set(point, normal, uv, falloff) {
    this.point.copy(point);
    this.normal.copy(normal);
    this.uv = uv;
    this.falloff = falloff;
    return this;
  }
}

export default VTRPSample;