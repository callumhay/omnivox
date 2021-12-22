import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTAmbientLight from '../VTAmbientLight';
import VTSpotLight from '../VTSpotLight';
import VTFog from '../VTFog';

const beaconSpot1StartDir = new THREE.Vector3(0,-1,0);
const beaconSpot2StartDir = new THREE.Vector3(0,1,0);

class BeaconsScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
    this.timeCounter = 0;

    this._rotBeacon1 = new THREE.Euler(0,0,0,'XYZ');
    this._rotBeacon2 = new THREE.Euler(Math.PI,0,0,'XYZ');
    this._rotBeacon3 = new THREE.Euler(0,0,Math.PI/2.0,'XYZ');
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {

    const {fogColour, fogScattering} = options;
    const fogOptions = {
      fogColour: new THREE.Color(fogColour.r, fogColour.g, fogColour.b), 
      scattering: fogScattering
    };

    if (!this._objectsBuilt) {
      const {
        ambientLightColour, beaconSpotAngles, beaconAtten,
        beacon1Colour1, beacon1Colour2, beacon2Colour1, beacon2Colour2,
        beacon3Colour1, beacon3Colour2,
      } = options;
      const size = this.voxelModel.xSize();

      this.fog = new VTFog(new THREE.Vector3(0,0,0), new THREE.Vector3(size, size, size), fogOptions);
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));
      
      const innerRadians = THREE.MathUtils.degToRad(beaconSpotAngles.inner);
      const outerRadians = THREE.MathUtils.degToRad(beaconSpotAngles.outer);
      
      const sizeDiv2 = size/2.0;
      const sizeDiv4 = size/4.0;

      this.beacon1Spot1 = new VTSpotLight(
        new THREE.Vector3(sizeDiv4, sizeDiv2, sizeDiv2), beaconSpot1StartDir.clone(),
        new THREE.Color(beacon1Colour1.r, beacon1Colour1.g, beacon1Colour1.b),
        innerRadians, outerRadians, {...beaconAtten}
      );
      this.beacon1Spot2 = new VTSpotLight(
        new THREE.Vector3(sizeDiv4, sizeDiv2, sizeDiv2), beaconSpot2StartDir.clone(),
        new THREE.Color(beacon1Colour2.r, beacon1Colour2.g, beacon1Colour2.b),
        innerRadians, outerRadians, {...beaconAtten}
      );

      this.beacon2Spot1 = new VTSpotLight(
        new THREE.Vector3(sizeDiv2, sizeDiv2, sizeDiv2), beaconSpot1StartDir.clone(),
        new THREE.Color(beacon2Colour1.r, beacon2Colour1.g, beacon2Colour1.b),
        innerRadians, outerRadians, {...beaconAtten}
      );
      this.beacon2Spot2 = new VTSpotLight(
        new THREE.Vector3(sizeDiv2, sizeDiv2, sizeDiv2), beaconSpot2StartDir.clone(),
        new THREE.Color(beacon2Colour2.r, beacon2Colour2.g, beacon2Colour2.b),
        innerRadians, outerRadians, {...beaconAtten}
      );

      this.beacon3Spot1 = new VTSpotLight(
        new THREE.Vector3(size-sizeDiv4, sizeDiv2, sizeDiv2), beaconSpot1StartDir.clone(),
        new THREE.Color(beacon3Colour1.r, beacon3Colour1.g, beacon3Colour1.b),
        innerRadians, outerRadians, {...beaconAtten}
      );
      this.beacon3Spot2 = new VTSpotLight(
        new THREE.Vector3(size-sizeDiv4, sizeDiv2, sizeDiv2), beaconSpot2StartDir.clone(),
        new THREE.Color(beacon3Colour2.r, beacon3Colour2.g, beacon3Colour2.b),
        innerRadians, outerRadians, {...beaconAtten}
      );

      this.beaconList = [
        {spot1: this.beacon1Spot1, spot2: this.beacon1Spot2, rot: this._rotBeacon1},
        {spot1: this.beacon2Spot1, spot2: this.beacon2Spot2, rot: this._rotBeacon2},
        {spot1: this.beacon3Spot1, spot2: this.beacon3Spot2, rot: this._rotBeacon3},
      ];

      this._objectsBuilt = true;
    }
    else {
      this.fog.options = fogOptions;
    }

    this.beaconList.forEach(beaconObj => {
      this.scene.addLight(beaconObj.spot1);
      this.scene.addLight(beaconObj.spot2);
    });
    this.scene.addLight(this.ambientLight);
    this.scene.addFog(this.fog);
  }

  async render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const {beacon1RotSpdMultiplier, beacon2RotSpdMultiplier, beacon3RotSpdMultiplier} = this._options;

    this._rotBeacon1.x = (beacon1RotSpdMultiplier*dt*Math.PI/4.0 + this._rotBeacon1.x);
    this._rotBeacon1.z = (beacon1RotSpdMultiplier*dt*Math.PI/6.0 + this._rotBeacon1.z);

    this._rotBeacon2.x = (-beacon2RotSpdMultiplier*dt*Math.PI/6.0 + this._rotBeacon2.x);
    this._rotBeacon2.z = (beacon2RotSpdMultiplier*dt*Math.PI/3.0 + this._rotBeacon2.z);

    this._rotBeacon3.x = (beacon3RotSpdMultiplier*dt*Math.PI/4.0 + this._rotBeacon3.x);
    this._rotBeacon3.z = (-beacon3RotSpdMultiplier*dt*Math.PI/6.0 + this._rotBeacon3.z);

    this.beaconList.forEach(beaconObj => {
      const newS1Dir = beaconSpot1StartDir.clone();
      const newS2Dir = beaconSpot2StartDir.clone();
      newS1Dir.applyEuler(beaconObj.rot);
      newS2Dir.applyEuler(beaconObj.rot);
      beaconObj.spot1.setDirection(newS1Dir);
      beaconObj.spot2.setDirection(newS2Dir);
    });

    this.timeCounter += dt;
    await this.scene.render();
  }
}

export default BeaconsScene;