import * as CANNON from 'cannon-es';
import * as THREE from 'three';

import PhysicsUtils from '../../PhysicsUtils';

import {PALETTE_MAP} from '../../Spectrum';

import VTVoxel from '../VTVoxel';
import VTSphere from '../VTSphere';
import VTEmissionMaterial from '../VTEmissionMaterial';

import VTPEmitterManager from '../Particles/VTPEmitterManager';
import VTPEmitter from '../Particles/VTPEmitter';
import VTPSpan from '../Particles/VTPSpan';
import {UniformConeDirGenerator, VTPBody, VTPLife, VTPMass, VTPRadius, VTPVelocity} from '../Particles/VTPInitializers';
import VTPColour from '../Particles/Behaviours/VTPColour';
import VTPPhysics from '../Particles/Behaviours/VTPPhysics';

import SceneRenderer from './SceneRenderer';
import VTPAlpha from '../Particles/Behaviours/VTPAlpha';
import VTPEase from '../Particles/VTPEase';

const WALL_COLLISION_GRP     = 1;
const PARTICLE_COLLISION_GRP = 2;

class ParticlePhysicsScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    if (this.world) { return; } // Already loaded?

    this.world = new CANNON.World();
    this.world.allowSleep = true;

    const wallMaterial      = new CANNON.Material('wall');
    const particleMaterial  = new CANNON.Material('particle');
    this.particleWallCM     = new CANNON.ContactMaterial(wallMaterial, particleMaterial, {friction: 0, restitution: 1});
    this.particleParticleCM = new CANNON.ContactMaterial(particleMaterial, particleMaterial, {friction: 0, restitution: 1});
    this.world.addContactMaterial(this.particleWallCM);
    this.world.addContactMaterial(this.particleParticleCM);

    // Create walls (collision planes) along the edges of the voxel box
    const wallBodies = PhysicsUtils.buildSideWalls(this.voxelModel.gridSize, wallMaterial);
    for (const wallBody of wallBodies) {
      this.world.addBody(wallBody);
      wallBody.collisionFilterGroup = WALL_COLLISION_GRP;
    }

    this.emitter = new VTPEmitter();

    this.emitterBodyInit = new VTPBody(VTVoxel, VTEmissionMaterial, {fill: true});
    this.emitter.addInitializer(this.emitterBodyInit);
    this.emitterLifeInit = new VTPLife();
    this.emitter.addInitializer(this.emitterLifeInit);
    this.dirGenerator = new UniformConeDirGenerator();
    this.emitterVelInit = new VTPVelocity(new VTPSpan(), this.dirGenerator);
    this.emitter.addInitializer(this.emitterVelInit);
    this.emitterMassInit = new VTPMass();
    this.emitter.addInitializer(this.emitterMassInit);
    this.emitterRadiusInit = new VTPRadius();
    this.emitter.addInitializer(this.emitterRadiusInit);

    this.colourBehaviour = new VTPColour();
    this.emitter.addBehaviour(this.colourBehaviour);
    this.emitter.addBehaviour(new VTPAlpha(1, 0, null, VTPEase.easeInOutBack));
    this.physicsBehaviour = new VTPPhysics(this.world, particleMaterial, PARTICLE_COLLISION_GRP);
    this.emitter.addBehaviour(this.physicsBehaviour);

    this.emitterMgr = new VTPEmitterManager(this.scene, 64, [VTVoxel, VTSphere]);
    this.emitterMgr.addEmitter(this.emitter);

    this.emitter.startEmit(Infinity);

    this.lastCallTime = 0;
  }
  unload() {
    this.world = null;
    this.particleWallCM = null; this.particleParticleCM = null;
    this.emitter = null;
    this.emitterBodyInit = null; this.emitterLifeInit = null; 
    this.emitterVelInit = null; this.emitterMassInit = null; this.emitterRadiusInit = null;
    this.dirGenerator = null;
    this.colourBehaviour = null; this.physicsBehaviour = null;
    this.emitterMgr = null;
  }

  setOptions(options) {
    const {
      gravity, friction, bounciness, enableParticleCollisions,
      particleSpawn, particleLife, particleSpeed, particleMass, particleRadius,
      particleType, particleColourPalette,
      emitterConeAngle, emitterPos
    } = options;

    this.world.gravity.copy(gravity);
    this.particleWallCM.friction     = friction; this.particleWallCM.restitution     = bounciness;
    this.particleParticleCM.friction = friction; this.particleParticleCM.restitution = bounciness;

    const vtObjNameToClass = {
      "VTVoxel"  : VTVoxel,
      "VTSphere" : VTSphere,
    };

    this.emitterBodyInit.bodyType = vtObjNameToClass[particleType];

    this.emitter.rate.numPan.a = particleSpawn.numMin; 
    this.emitter.rate.numPan.b = particleSpawn.numMax;
    this.emitter.rate.timePan.a = this.emitter.rate.timePan.b = particleSpawn.interval;
    this.emitter.rate.init();

    this.emitterLifeInit.lifeSpan.a = particleLife.min;
    this.emitterLifeInit.lifeSpan.b = particleLife.max;
    this.emitterVelInit.speedSpan.a = particleSpeed.min;
    this.emitterVelInit.speedSpan.b = particleSpeed.max;
    this.emitterMassInit.massSpan.a = particleMass.min;
    this.emitterMassInit.massSpan.b = particleMass.max;
    const isVoxel = particleType === "VTVoxel";
    this.emitterRadiusInit.radiusSpan.a = isVoxel ? 0.5 : particleRadius.min;
    this.emitterRadiusInit.radiusSpan.b = isVoxel ? 0.5 : particleRadius.max;

    this.emitter.p.copy(emitterPos);

    this.colourBehaviour.reset(PALETTE_MAP[particleColourPalette]);
    this.physicsBehaviour.collisionFilterMask = WALL_COLLISION_GRP | (enableParticleCollisions ? PARTICLE_COLLISION_GRP : 0); 
    
    this.dirGenerator.halfAngle = THREE.MathUtils.degToRad(emitterConeAngle);

    super.setOptions(options);
  }

  async render(dt) {
    this.lastCallTime = PhysicsUtils.stepWorld(this.world, this.lastCallTime, dt);
    this.emitterMgr.tick(dt);
    await this.scene.render();
  }
}

export default ParticlePhysicsScene;
