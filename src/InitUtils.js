import * as THREE from 'three';

class InitUtils {

  static initValue(value, defaults) {
    return (value !== null && value !== undefined) ? value : defaults;
  }

  static initTHREEColor(value, defaultR=0, defaultG=0, defaultB=0) {
    return (value !== undefined) ? 
      ((value instanceof THREE.Color) ? value : new THREE.Color(value.r, value.g, value.b)) : 
      new THREE.Color(defaultR, defaultG, defaultB);
  }
  static initTHREEVector3(value, defaultX=0, defaultY=0, defaultZ=0) {
    return (value !== undefined) ? 
      ((value instanceof THREE.Vector3) ? value : new THREE.Vector3(value.x, value.y, value.z)) : 
      new THREE.Vector3(defaultX, defaultY, defaultZ);
  }

  static classApply(constructor, args = null) {
    if (!args) { return new constructor(); } 
    else {
      const factoryFunc = constructor.bind.apply(constructor, [null, ...args]);
      return new factoryFunc();
    }
  }
}

export default InitUtils;
