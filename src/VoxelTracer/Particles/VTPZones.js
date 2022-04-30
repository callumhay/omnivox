import * as THREE from 'three';
import { Randomizer } from '../../Randomizers';


class VTPZone {
  constructor() {}
  getPosition(target) { console.error("getPosition unimplemented abstract method called."); return null; }
  //crossing(particle) {}
  //destroy() {}
}

export class VTPPointZone extends VTPZone {
  constructor(x=0,y=0,z=0) {
    super();
    this.position = new THREE.Vector3(x,y,z);
  }

  getPosition(target) { return target.copy(this.position); }
}

const _randomVec = new THREE.Vector3();
export class VTPBoxZone extends VTPZone {
  constructor(minPt, maxPt) {
    super();
    this.minPt = (new THREE.Vector3()).copy(minPt);
    this.size = new THREE.Vector3();
    this.size.subVectors(maxPt, minPt);
  }

  getPosition(target) {
    // Set the target to a random position inside or on the box...
    _randomVec.set(
      Randomizer.getRandomFloat(this.minPt.x, this.minPt.x+this.size.x),
      Randomizer.getRandomFloat(this.minPt.y, this.minPt.y+this.size.y),
      Randomizer.getRandomFloat(this.minPt.z, this.minPt.z+this.size.z)
    );
    return target.copy(this.minPt).add(_randomVec);
  }
}