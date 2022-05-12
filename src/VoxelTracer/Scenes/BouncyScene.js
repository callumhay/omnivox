import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import SceneRenderer from './SceneRenderer';

import VTSphere, {defaultSphereOptions} from '../VTSphere';
import VTLambertMaterial from '../VTLambertMaterial';
//import VTPointLight from '../VTPointLight';
import VTDirectionalLight from '../VTDirectionalLight';
import VTAmbientLight from '../VTAmbientLight';

import PhysicsUtils from '../../PhysicsUtils';
import {Randomizer} from '../../Randomizers';
import {SCRIABIN_NOTE_COLOURS} from '../../Spectrum';

const calcSphereMass = (radius, density) => 4/3 * Math.PI * Math.pow(radius,3) * density;

class BouncyScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    this.world = new CANNON.World();
    this.world.allowSleep = true;

    this.wallMaterial = new CANNON.Material('wall');
    this.sphereMaterial = new CANNON.Material('sphere');
    this.sphereWallCM   = new CANNON.ContactMaterial(this.wallMaterial, this.sphereMaterial, {friction: 0, restitution: 1});
    this.sphereSphereCM = new CANNON.ContactMaterial(this.sphereMaterial, this.sphereMaterial, {friction: 0, restitution: 1});
    this.world.addContactMaterial(this.sphereWallCM);
    this.world.addContactMaterial(this.sphereSphereCM);

    // Create walls (collision planes) along the edges of the voxel box
    const wallBodies = PhysicsUtils.buildSideWalls(this.voxelModel.gridSize, this.wallMaterial);
    for (const wallBody of wallBodies) { this.world.addBody(wallBody); }
    
    this.sphereShapes = [];
    this.sphereBodies = [];
    this.vtSpheres = [];

    this.directionalLight1 = new VTDirectionalLight();
    this.directionalLight2 = new VTDirectionalLight();
    this.ambientLight = new VTAmbientLight();

    this.lastCallTime = 0;
  }
  unload() {
    this.world = null;
    this.wallMaterial = null; this.sphereMaterial = null;
    this.sphereWallCM = null; this.sphereSphereCM = null;
    this.sphereShapes = null;
    this.sphereBodies = null;
    this.vtSpheres = null;
    this.directionalLight1 = null;
    this.directionalLight2 = null;
    this.ambientLight = null;
  }

  setOptions(options) {
    const {
      minSphereRadius, maxSphereRadius, sphereDensity,
      ambientLightColour, dirLight1Colour, dirLight1Dir,
      dirLight2Colour, dirLight2Dir, numSpheres, bounciness, 
      friction, gravity, maxInitialVelocity
    } = options;

    // Set the adjustable physical quantities/constraints on the CANNON world and materials
    this.world.gravity.set(0, gravity, 0);
    this.sphereWallCM.friction = friction; this.sphereWallCM.restitution = bounciness;
    this.sphereSphereCM.friction = friction; this.sphereSphereCM.restitution = bounciness;
  
    // Build the bouncy balls (if the number of balls has changed)
    if (!this._options || this._options.numSpheres !== numSpheres || 
        this._options.minSphereRadius !== minSphereRadius || this._options.maxSphereRadius !== maxSphereRadius ||
        this._options.maxInitialVelocity !== maxInitialVelocity || this._options.sphereDensity !== sphereDensity) {

      // Clean up all previous sphere objects
      for (const sphereBody of this.sphereBodies) { this.world.removeBody(sphereBody); }
      this.sphereShapes = [];
      this.sphereBodies = [];
      this.vtSpheres    = [];

      const size = this.voxelModel.xSize();
      const avgRandRadius = (minSphereRadius+maxSphereRadius)/2;
      const partitionSize = 2*avgRandRadius + 1;
      const numPartitionsPerDim = Math.floor(size / partitionSize);
      const totalPossiblePartitions = Math.pow(numPartitionsPerDim,3);
      const actualNumSpheres = Math.min(totalPossiblePartitions, numSpheres);

      let xIdx = 0, yIdx = numPartitionsPerDim-1, zIdx = 0;
      let randomColourIdx = Randomizer.getRandomInt(0,SCRIABIN_NOTE_COLOURS.length-1);
      for (let i = 0; i < actualNumSpheres; i++) {

        const sphereRadius = Math.round(2*Randomizer.getRandomFloat(minSphereRadius, Math.max(minSphereRadius, maxSphereRadius)))/2;

        const currX = xIdx*partitionSize + sphereRadius;
        const currY = yIdx*partitionSize + sphereRadius;
        const currZ = zIdx*partitionSize + sphereRadius;
        xIdx++;
        if (xIdx >= numPartitionsPerDim) {
          xIdx = 0; zIdx++;
          if (zIdx >= numPartitionsPerDim) { 
            zIdx = 0; yIdx--;
          }
        }

        const sphereShape = new CANNON.Sphere(sphereRadius);
        const sphereBody  = new CANNON.Body({
          mass: calcSphereMass(sphereRadius, sphereDensity),
          material: this.sphereMaterial, 
          position: new CANNON.Vec3(currX, currY, currZ),
          velocity: new CANNON.Vec3(
            Randomizer.getRandomPositiveOrNegative() * Randomizer.getRandomFloat(3,maxInitialVelocity), 
            Randomizer.getRandomPositiveOrNegative() * Randomizer.getRandomFloat(3,maxInitialVelocity), 
            Randomizer.getRandomPositiveOrNegative() * Randomizer.getRandomFloat(3,maxInitialVelocity)
          ),
        });
        sphereBody.addShape(sphereShape);

        sphereBody.linearDamping  = friction > 0.001 ? 0.01 : 0.0;
        sphereBody.angularDamping = friction > 0.001 ? 0.01 : 0.0;
        sphereBody.allowSleep = true;
        sphereBody.sleepSpeedLimit = 0.25;
        sphereBody.sleepTimeLimit = 3;

        this.world.addBody(sphereBody);
        this.sphereShapes.push(sphereShape);
        this.sphereBodies.push(sphereBody);

        const sphereColour = SCRIABIN_NOTE_COLOURS[(randomColourIdx+i)%SCRIABIN_NOTE_COLOURS.length];
        this.vtSpheres.push(
          new VTSphere(
            new THREE.Vector3(currX, currY, currZ), sphereRadius, 
            new VTLambertMaterial(new THREE.Color(sphereColour.r,sphereColour.g,sphereColour.b)),
            {...defaultSphereOptions, fill: true}
          )
        );
      }
    }

    this.ambientLight.setColour(ambientLightColour);
    this.directionalLight1.setDirection(dirLight1Dir).setColour(dirLight1Colour);
    this.directionalLight2.setDirection(dirLight2Dir).setColour(dirLight2Colour);

    for (const vtSphere of this.vtSpheres) { this.scene.addObject(vtSphere); }
    this.scene.addObject(this.directionalLight1);
    this.scene.addObject(this.directionalLight2);
    this.scene.addObject(this.ambientLight);

    super.setOptions(options);
  }

  async render(dt) {
    // Simulate the physics
    this.lastCallTime = PhysicsUtils.stepWorld(this.world, this.lastCallTime, dt);

    // Update the voxel tracer / renderer based on the physics
    for (let i = 0; i < this.sphereBodies.length; i++) {
      const sphereBody = this.sphereBodies[i];
      const vtSphere = this.vtSpheres[i];
      
      const {position:spherePos} = sphereBody;
      vtSphere.position.copy(spherePos);
      vtSphere.makeDirty();
    }

    await this.scene.render();
  }

}

export default BouncyScene;
