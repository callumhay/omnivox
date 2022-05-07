import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTAmbientLight from '../VTAmbientLight';
import VTSpotLight from '../VTSpotLight';
import {VTFogBox} from '../VTFog';

const beaconSpot1StartDir = new THREE.Vector3(0,-1,0);
const beaconSpot2StartDir = new THREE.Vector3(0,1,0);

class BeaconsScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    const size = this.voxelModel.gridSize;
    const sizeDiv2 = size/2.0;
    const sizeDiv4 = size/4.0;

    this._rotBeacon1 = new THREE.Euler(0,0,0,'XYZ');
    this._rotBeacon2 = new THREE.Euler(Math.PI,0,0,'XYZ');
    this._rotBeacon3 = new THREE.Euler(0,0,Math.PI/2.0,'XYZ');

    this.fog = new VTFogBox(new THREE.Vector3(0,0,0), new THREE.Vector3(size, size, size));
    this.ambientLight = new VTAmbientLight();

    this.beacon1Spot1 = new VTSpotLight(new THREE.Vector3(sizeDiv4, sizeDiv2, sizeDiv2));
    this.beacon1Spot2 = new VTSpotLight(new THREE.Vector3(sizeDiv4, sizeDiv2, sizeDiv2));

    this.beacon2Spot1 = new VTSpotLight(new THREE.Vector3(sizeDiv2, sizeDiv2, sizeDiv2));
    this.beacon2Spot2 = new VTSpotLight(new THREE.Vector3(sizeDiv2, sizeDiv2, sizeDiv2));

    this.beacon3Spot1 = new VTSpotLight(new THREE.Vector3(size-sizeDiv4, sizeDiv2, sizeDiv2));
    this.beacon3Spot2 = new VTSpotLight(new THREE.Vector3(size-sizeDiv4, sizeDiv2, sizeDiv2));

    this.beaconList = [
      {spot1: this.beacon1Spot1, spot2: this.beacon1Spot2, rot: this._rotBeacon1},
      {spot1: this.beacon2Spot1, spot2: this.beacon2Spot2, rot: this._rotBeacon2},
      {spot1: this.beacon3Spot1, spot2: this.beacon3Spot2, rot: this._rotBeacon3},
    ];

    this.timeCounter = 0;
  }
  unload() {
    this._rotBeacon1 = null;
    this._rotBeacon2 = null;
    this._rotBeacon3 = null;

    this.fog = null;
    this.ambientLight = null;

    this.beacon1Spot1 = null; this.beacon1Spot2 = null;
    this.beacon2Spot1 = null; this.beacon2Spot2 = null;
    this.beacon3Spot1 = null; this.beacon3Spot2 = null;

    this.beaconList = null;
  }

  setOptions(options) {
    const {
      fogColour, fogScattering,
      ambientLightColour, beaconSpotAngles, beaconAtten,
      beacon1Colour1, beacon1Colour2, beacon2Colour1, beacon2Colour2,
      beacon3Colour1, beacon3Colour2,
    } = options;
    
    this.fog.setColour(fogColour).setScattering(fogScattering);
    this.ambientLight.setColour(ambientLightColour);

    this.beacon1Spot1.setColour(beacon1Colour1);
    this.beacon1Spot2.setColour(beacon1Colour2);

    this.beacon2Spot1.setColour(beacon2Colour1);
    this.beacon2Spot2.setColour(beacon2Colour2);

    this.beacon3Spot1.setColour(beacon3Colour1);
    this.beacon3Spot2.setColour(beacon3Colour2);

    const innerRadians = THREE.MathUtils.degToRad(beaconSpotAngles.inner);
    const outerRadians = THREE.MathUtils.degToRad(beaconSpotAngles.outer);
    for (const beaconObj of this.beaconList) {
      const {spot1, spot2} = beaconObj;
      spot1.setDirection(beaconSpot1StartDir).setConeAngles(innerRadians, outerRadians).setRangeAttenuation(beaconAtten);
      spot2.setDirection(beaconSpot2StartDir).setConeAngles(innerRadians, outerRadians).setRangeAttenuation(beaconAtten);
      this.scene.addObject(beaconObj.spot1);
      this.scene.addObject(beaconObj.spot2);
    }

    this.scene.addObject(this.ambientLight);
    this.scene.addObject(this.fog);

    super.setOptions(options);
  }

  async render(dt) {
    const {beacon1RotSpdMultiplier, beacon2RotSpdMultiplier, beacon3RotSpdMultiplier} = this._options;

    this._rotBeacon1.x = (beacon1RotSpdMultiplier*dt*Math.PI/4.0 + this._rotBeacon1.x);
    this._rotBeacon1.z = (beacon1RotSpdMultiplier*dt*Math.PI/6.0 + this._rotBeacon1.z);

    this._rotBeacon2.x = (-beacon2RotSpdMultiplier*dt*Math.PI/6.0 + this._rotBeacon2.x);
    this._rotBeacon2.z = (beacon2RotSpdMultiplier*dt*Math.PI/3.0 + this._rotBeacon2.z);

    this._rotBeacon3.x = (beacon3RotSpdMultiplier*dt*Math.PI/4.0 + this._rotBeacon3.x);
    this._rotBeacon3.z = (-beacon3RotSpdMultiplier*dt*Math.PI/6.0 + this._rotBeacon3.z);

    for (const beaconObj of this.beaconList) {
      const newS1Dir = beaconSpot1StartDir.clone();
      const newS2Dir = beaconSpot2StartDir.clone();
      newS1Dir.applyEuler(beaconObj.rot);
      newS2Dir.applyEuler(beaconObj.rot);
      beaconObj.spot1.setDirection(newS1Dir);
      beaconObj.spot2.setDirection(newS2Dir);
    }

    this.timeCounter += dt;
    await this.scene.render();
  }
}

export default BeaconsScene;