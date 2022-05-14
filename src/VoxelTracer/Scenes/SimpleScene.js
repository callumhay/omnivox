
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

import VoxelModel from '../../Server/VoxelModel';
import VoxelPostProcessPipeline from '../../Server/PostProcess/VoxelPostProcessPipeline';
import VoxelDistortionPP from '../../Server/PostProcess/VoxelDistortionPP';
import VoxelConstants from '../../VoxelConstants';

import {Randomizer} from '../../Randomizers';
import PhysicsUtils from '../../PhysicsUtils';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';
import VTSphere from '../VTSphere';

import SceneRenderer from './SceneRenderer';

const _tempVec3_0 = new THREE.Vector3();

class SimpleScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    if (this.sphere) { return; } // Already loaded?
    
    const size = this.voxelModel.xSize();
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    this.sphere = new VTSphere(null, 1, new VTLambertMaterial());

    this.wallXMesh = new VTMesh(new THREE.BoxBufferGeometry(0.9,size,size), new VTLambertMaterial());
    this.wallXMesh.position.set(0, halfYSize, halfZSize);
    this.wallYMesh = new VTMesh(new THREE.BoxBufferGeometry(size,0.9,size), new VTLambertMaterial());
    this.wallYMesh.position.set(halfXSize, 0, halfZSize);
    this.wallZMesh = new VTMesh(new THREE.BoxBufferGeometry(size,size,0.9), new VTLambertMaterial());
    this.wallZMesh.position.set(halfXSize, halfYSize, 0);

    this.ptLights = [new VTPointLight(), new VTPointLight(), new VTPointLight()];
    this.ambientLight = new VTAmbientLight();

    this.postProcessPipeline = new VoxelPostProcessPipeline(this.voxelModel);
    this.distortion = new VoxelDistortionPP(this.voxelModel);
    this.postProcessPipeline.addPostProcess(this.distortion);

    this.world = new CANNON.World();
    this.world.gravity.set(0,0,0);
    this.physicsMaterial = new CANNON.Material('material');
    this.physMaterialCM = new CANNON.ContactMaterial(this.physicsMaterial, this.physicsMaterial, {friction: 0, restitution: 1});
    this.world.addContactMaterial(this.physMaterialCM);

    // Create walls (collision planes) along the edges of the voxel box
    const wallBodies = PhysicsUtils.buildSideWalls(this.voxelModel.gridSize, this.physicsMaterial);
    for (const wallBody of wallBodies) { this.world.addBody(wallBody); }
    this.sphereBody = null;
    this.lightBodies = [];

    this.timeCounter = 0;
    this.lastCallTime = 0;
  }
  unload() {
    this.sphere = null;
    this.wallXMesh = null; this.wallYMesh = null; this.wallZMesh = null;
    this.ptLights = null;
    this.ambientLight = null;
    this.postProcessPipeline = null; this.distortion = null;

    this.world = null;
    this.physicsMaterial = null; this.physMaterialCM = null;
    this.sphereBody = null; this.lightBodies = null;
  }

  setOptions(options) {
    const {
      noiseAlpha, noiseSpeed, distortHorizontal, distortVertical,
      wallX, wallY, wallZ, wallColour,
      sphereRadius, sphereColour, sphereEmission, sphereFill,
      ambientLightColour, enableLightPhysics, pointLightsSpd,
      pointLight1Colour, pointLight2Colour, pointLight3Colour, pointLightAtten, 
    } = options;

    super.setOptions(options);

    _tempVec3_0.set(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);
    this.sphere.setCenter(_tempVec3_0).setRadius(sphereRadius).setOptions({fill: sphereFill});
    this.sphere.material.colour.copy(sphereColour);
    this.sphere.material.emissive.copy(sphereEmission);

    this.ptLights[0].setColour(pointLight1Colour).setAttenuation(pointLightAtten);
    this.ptLights[1].setColour(pointLight2Colour).setAttenuation(pointLightAtten);
    this.ptLights[2].setColour(pointLight3Colour).setAttenuation(pointLightAtten);

    this.ambientLight.setColour(ambientLightColour);

    this.distortion.setConfig({noiseAlpha, noiseSpeed, distortHorizontal, distortVertical});

    for (const ptLight of this.ptLights) { this.scene.addObject(ptLight); }
    this.scene.addObject(this.ambientLight);
    this.scene.addObject(this.sphere);

    if (wallX) {
      this.wallXMesh.material.setColour(wallColour);
      this.scene.addObject(this.wallXMesh);
    }
    if (wallY) {
      this.wallYMesh.material.setColour(wallColour);
      this.scene.addObject(this.wallYMesh);
    }
    if (wallZ) {
      this.wallZMesh.material.setColour(wallColour);
      this.scene.addObject(this.wallZMesh);
    }

    for (const ptLightBody of this.lightBodies) { this.world.removeBody(ptLightBody); }
    if (this.sphereBody) { this.world.removeBody(this.sphereBody); this.sphereBody = null; }
    this.lightBodies = [];

    if (enableLightPhysics) {
      this.sphereBody = new CANNON.Body({
        mass: 0,
        material: this.physicsMaterial,
        position: (new CANNON.Vec3()).copy(this.sphere.center),
        shape: new CANNON.Sphere(sphereRadius),
      });
      this.world.addBody(this.sphereBody);

      for (let i = 0; i < this.ptLights.length; i++) {
        const ptLight = this.ptLights[i];
        this._lightPositionCalc(_tempVec3_0, 0, i);
        ptLight.position.copy(_tempVec3_0);

        const phi = Randomizer.getRandomFloat(0, 2*Math.PI);
        const theta = Math.acos(Randomizer.getRandomFloat(-1,1));
        _tempVec3_0.setFromSphericalCoords(1, phi, theta);

        const ptLightBody  = new CANNON.Body({
          mass: 1,
          material: this.physicsMaterial, 
          position: (new CANNON.Vec3()).copy(ptLight.position),
          velocity: (new CANNON.Vec3()).copy(_tempVec3_0.multiplyScalar(pointLightsSpd)),
          angularDamping: 0.01,
          linearDamping: 0.001,
          shape: new CANNON.Sphere(VoxelConstants.VOXEL_HALF_UNIT_SIZE),
          type: CANNON.Body.DYNAMIC,
        });

        this.world.addBody(ptLightBody);
        this.lightBodies.push(ptLightBody);
      }
    }
  }

  async render(dt) {
    const {pointLightsSpd, enableLightPhysics} = this._options;

    if (enableLightPhysics) {
      this.lastCallTime = PhysicsUtils.stepWorld(this.world, this.lastCallTime, dt);
      for (let i = 0; i < this.ptLights.length; i++) {
        const ptLight = this.ptLights[i];
        const ptLightBody = this.lightBodies[i];
        ptLight.position.copy(ptLightBody.position);
        ptLight.makeDirty();
      }
    }
    else {
      const t = this.timeCounter*pointLightsSpd;

      // Move lights around in circles...
      for (let i = 0; i < this.ptLights.length; i++) {
        const ptLight = this.ptLights[i];
        this._lightPositionCalc(ptLight.position, t, i);
        ptLight.makeDirty();
      }
      this.timeCounter += dt;
    }

    await this.scene.render();
    this.postProcessPipeline.render(dt, VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }

  _lightPositionCalc(target, t, lightIdx) {

    const {sphereRadius} = this._options;
    const lightMovementRadius = sphereRadius + (this.voxelModel.xSize()-2 - 2*sphereRadius)/2;
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    switch (lightIdx) {
      default: case 0:
        target.set(lightMovementRadius*Math.cos(t) + halfXSize, halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);
        break;
      case 1:
        target.set(halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);
        break;
      case 2:
        target.set(lightMovementRadius*Math.sin(t) + halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, halfZSize);
        break;
    }
    return target;
  }

}

export default SimpleScene;
