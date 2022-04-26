import * as THREE from 'three';

import VoxelConstants from "../../../VoxelConstants";
import InitUtils from '../../../InitUtils';

import VTPBehaviour from "./VTPBehaviour";

class VTPAttraction extends VTPBehaviour {
  constructor(targetPosition, force, radius, life, easing) {
    super(life, easing);
    this.reset(targetPosition, force, radius);
  }

  reset(targetPosition, force, radius, life=null, easing=null) {
    this.targetPosition = InitUtils.initValue(targetPosition, new THREE.Vector3(0,0,0));
		this.radius = InitUtils.initValue(radius, VoxelConstants.VOXEL_DIAGONAL_GRID_SIZE + 1);
		this.force = InitUtils.initValue(force, VoxelConstants.VOXEL_DIAGONAL_GRID_SIZE/10);
		
    this.radiusSq = this.radius * this.radius
		this.attractionForce = new THREE.Vector3(0,0,0);
		this.lengthSq = 0;

    life && easing && super.reset(life, easing);
  }

  applyBehaviour(particle, dt, index) {
		super.applyBehaviour(particle, dt, index);

		this.attractionForce.copy(this.targetPosition);
		this.attractionForce.sub(particle.p);
		this.lengthSq = this.attractionForce.lengthSq();

		if (this.lengthSq > VoxelConstants.VOXEL_EPSILON && this.lengthSq < this.radiusSq) {
			this.attractionForce.normalize();
			this.attractionForce.multiplyScalar(1 - this.lengthSq / this.radiusSq);
			this.attractionForce.multiplyScalar(this.force);
			particle.a.add(this.attractionForce);
		}
	}
}

export default VTPAttraction;
