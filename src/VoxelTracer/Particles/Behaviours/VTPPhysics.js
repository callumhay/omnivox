
import * as CANNON from 'cannon-es';
import InitUtils from '../../../InitUtils';

import VTPBehaviour from "./VTPBehaviour";

class VTPPhysics extends VTPBehaviour {
  constructor(physicsWorld, particlePhysicsMaterial, collisionGrp=1, collisionFilterMask=-1, life=null, easing=null) {
    super(life, easing);
    this.reset(physicsWorld, particlePhysicsMaterial, collisionGrp, collisionFilterMask);
  }

  reset(physicsWorld, particlePhysicsMaterial, collisionGrp, collisionFilterMask, life=null, easing=null) {
    super.reset(life, easing);
    this.physicsWorld = physicsWorld;
    this.particlePhysicsMaterial = particlePhysicsMaterial;
    this.collisionGrp = InitUtils.initValue(collisionGrp, 1);
    this.collisionFilterMask = InitUtils.initValue(collisionFilterMask, -1);
  }

  initialize(particle) {
    // Create a physics body for the particle and add it to the world
    const particleShape = new CANNON.Sphere(particle.radius);
    const particleBody  = new CANNON.Body({
      mass: particle.mass,
      material: this.particlePhysicsMaterial, 
      position: (new CANNON.Vec3()).copy(particle.p),
      velocity: (new CANNON.Vec3()).copy(particle.v),
      collisionFilterGroup: this.collisionGrp,
      collisionFilterMask: this.collisionFilterMask,
    });
    particleBody.addShape(particleShape);
    particle.physicsBody = particleBody;
    this.physicsWorld.addBody(particleBody);
  }

  remove(particle) {
    if (!particle.physicsBody) { return; }
    this.physicsWorld.removeBody(particle.physicsBody);
    particle.physicsBody = null;
  }

  applyBehaviour(particle, dt, index) {
    super.applyBehaviour(particle, dt, index);
    if (!particle.physicsBody) { return; }

    // Update the transform of the particle based on the physics world
    const {position, velocity} = particle.physicsBody;
    particle.p.copy(position);
    particle.v.copy(velocity);
    particle.a.set(0,0,0);

    if (this.energy < 0.001) {
      this.physicsWorld.removeBody(particle.physicsBody);
      particle.physicsBody = null;
    }
  }
}

export default VTPPhysics;
