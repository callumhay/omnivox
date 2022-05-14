import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import {VTFogBox} from '../VTFog';
import VTAmbientLight from '../VTAmbientLight';

const _buildMovingBoxGeometry = (size) => size ? new THREE.BoxBufferGeometry(size.x, size.y, size.z, 1, 1, 1) : null;

class GodRayScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    if (this.fog) { return; } // Already loaded?

    const size = this.voxelModel.xSize();
    const boxSize = this._options ? this._options.shapeSize :  null;

    this._shapePosition = new THREE.Vector3(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);
    this._shapeRotation = new THREE.Euler(0,0,0);
    
    this.fog = new VTFogBox(new THREE.Vector3(0,0,0), new THREE.Vector3(size, size, size));
    this.shapeMesh = new VTMesh(_buildMovingBoxGeometry(boxSize), new VTLambertMaterial());
    this.ptLight = new VTPointLight();
    this.ambientLight = new VTAmbientLight();

    this._timeCounter = 0;
  }
  unload() {
    this._shapePosition = null; this._shapeRotation = null;
    this.fog = null;
    this.shapeMesh = null;
    this.ptLight = null;
    this.ambientLight = null;
  }

  setOptions(options) {
    const {
      fogColour, fogScattering, 
      shapeSize, shapeColour, shapeEmission,
      ambientLightColour, pointLightColour, pointLightPosition, pointLightAtten
    } = options;

    this.fog.setColour(fogColour).setScattering(fogScattering);

    this.shapeMesh.material.setColour(shapeColour);
    this.shapeMesh.material.setEmissive(shapeEmission);
    this.shapeMesh.setGeometry(_buildMovingBoxGeometry(shapeSize));
    this.shapeMesh.position.copy(this._shapePosition);
    this.shapeMesh.setRotationFromEuler(this._shapeRotation);

    this.ptLight.setPosition(pointLightPosition).setColour(pointLightColour).setAttenuation(pointLightAtten);
    this.ambientLight.setColour(ambientLightColour);

    this.scene.addObject(this.shapeMesh);
    this.scene.addObject(this.ptLight);
    this.scene.addObject(this.fog);
    this.scene.addObject(this.ambientLight);

    super.setOptions(options);
  }

  async render(dt) {
    const {shapeRotationSpd} = this._options;
    const newRX = this._shapeRotation.x + dt*shapeRotationSpd.x;
    const newRY = this._shapeRotation.y + dt*shapeRotationSpd.y;
    const newRZ = this._shapeRotation.z + dt*shapeRotationSpd.z;
    this._shapeRotation.set(newRX, newRY, newRZ, 'XYZ');
    this.shapeMesh.setRotationFromEuler(this._shapeRotation);

    this._timeCounter += dt;
    await this.scene.render();
  }

};

export default GodRayScene;