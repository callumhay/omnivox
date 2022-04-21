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

class BouncyScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
    this.world  = null;
    this.sphereShapes = [];
    this.sphereBodies = [];
    this.vtSpheres = [];
    this.directionalLight1 = null;
    this.directionalLight2 = null;
    this.ambientLight = null;
    
    this.lastCallTime = 0;
  }

  build(options) {
    if (!options) { return; }
    const {minSphereRadius, maxSphereRadius, sphereDensity} = options;

    if (!this._objectsBuilt) {
      const {
        ambientLightColour, dirLight1Colour, dirLight1Dir,
        dirLight2Colour, dirLight2Dir, numSpheres, bounciness, 
        friction, gravity, maxInitialVelocity
      } = options;

      const size = this.voxelModel.xSize();

      this.world = new CANNON.World();
      this.world.gravity.set(0, gravity, 0);
      this.world.allowSleep = true;

      // Create walls (collision planes) along the edges of the voxel box
      const wallMaterial = new CANNON.Material('wall');
      const wallBodies = PhysicsUtils.buildSideWalls(size, wallMaterial);
      for (const wallBody of wallBodies) { this.world.addBody(wallBody); }

      const sphereMaterial = new CANNON.Material('sphere');
      const avgRandRadius = (minSphereRadius+maxSphereRadius)/2;
      const partitionSize = 2*avgRandRadius;
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
          mass: 4/3 * Math.PI * Math.pow(sphereRadius,3) * sphereDensity,
          material: sphereMaterial,
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
            new THREE.Vector3(currX, currY, currZ), sphereRadius, new VTLambertMaterial(new THREE.Color(sphereColour.r,sphereColour.g,sphereColour.b)),
            {...defaultSphereOptions, fill: true}
          )
        );
      }

      const sphereWallCM   = new CANNON.ContactMaterial(wallMaterial, sphereMaterial, {friction: friction, restitution: bounciness});
      const sphereSphereCM = new CANNON.ContactMaterial(sphereMaterial, sphereMaterial, {friction: friction, restitution: bounciness});
      this.world.addContactMaterial(sphereWallCM);
      this.world.addContactMaterial(sphereSphereCM);

      this.ambientLight = new VTAmbientLight(
        new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b)
      );
      this.directionalLight1 = new VTDirectionalLight(
        new THREE.Vector3(dirLight1Dir.x, dirLight1Dir.y, dirLight1Dir.z),
        new THREE.Color(dirLight1Colour.r, dirLight1Colour.g, dirLight1Colour.b)
      );
      this.directionalLight2 = new VTDirectionalLight(
        new THREE.Vector3(dirLight2Dir.x, dirLight2Dir.y, dirLight2Dir.z),
        new THREE.Color(dirLight2Colour.r, dirLight2Colour.g, dirLight2Colour.b)
      );

      this._objectsBuilt = true;
    }

    for (const vtSphere of this.vtSpheres) { this.scene.addObject(vtSphere); }
    this.scene.addObject(this.directionalLight1);
    this.scene.addObject(this.directionalLight2);
    this.scene.addObject(this.ambientLight);
  }

  async render(dt) {
    if (!this._objectsBuilt) { return; }

    // Simulate the physics
    const now = Date.now() / 1000;
    if (!this.lastCallTime) {
      // Last call time not saved, can't guess elapsed time. Take a simple step.
      this.world.step(dt);
      this.lastCallTime = now;
    }
    else {
      let timeSinceLastCall = now - this.lastCallTime;
      this.world.step(dt);
      this.world.step(dt, timeSinceLastCall, 20);
      this.lastCallTime = now;
    }

    // Update the voxel tracer / renderer based on the physics
    for (let i = 0; i < this.sphereBodies.length; i++) {
      const sphereBody = this.sphereBodies[i];
      const vtSphere = this.vtSpheres[i];
      
      const {position:spherePos} = sphereBody;
      vtSphere.center.set(spherePos.x, spherePos.y, spherePos.z);
      vtSphere.setCenter(vtSphere.center);
    }

    await this.scene.render();
  }

}

export default BouncyScene;
