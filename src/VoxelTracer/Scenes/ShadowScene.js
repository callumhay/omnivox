import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTSphere from '../VTSphere';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';

const _buildMovingBoxGeometry = (size) => size ? new THREE.BoxBufferGeometry(size.x, size.y, size.z, 1, 1, 1) : null;
const _tempEuler = new THREE.Euler();

class ShadowScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    const size = this.voxelModel.xSize();
    const halfXSize = this.voxelModel.xSize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    const mvBoxSize = this._options ? this._options.movingBoxSize :  null;
    this.movingBoxMesh = new VTMesh(_buildMovingBoxGeometry(mvBoxSize), new VTLambertMaterial(new THREE.Color(1,1,1)));
    
    this.boxMesh = new VTMesh(new THREE.BoxBufferGeometry(size,2,size), new VTLambertMaterial(new THREE.Color(1,1,1)));
    this.boxMesh.position.set(halfXSize, size-1, halfZSize);
    
    this.sphere = new VTSphere(
      new THREE.Vector3(halfXSize-0.5, halfXSize-0.5, halfXSize-0.5), 3.0,  
      new VTLambertMaterial(new THREE.Color(1,1,1))
    );
    
    this.ptLight = new VTPointLight();
    this.ambientLight = new VTAmbientLight();
    this.timeCounter = 0;
  }
  unload() {
    this.movingBoxMesh = null;
    this.boxMesh = null;
    this.sphere = null;
    this.ptLight = null;
    this.ambientLight = null;
  }

  setOptions(options) {
    const {
      movingBoxSize, ambientLightColour, 
      pointLightColour, pointLightPosition, pointLightAtten, 
      sphereFill, sphereRadius
    } = options;

    const prevBoxSize = this._options ? this._options.movingBoxSize : null;
    if (!this._options || movingBoxSize.x !== prevBoxSize.x || 
      movingBoxSize.y !== prevBoxSize.y || movingBoxSize.z !== prevBoxSize.z) {

      this.movingBoxMesh.setGeometry(_buildMovingBoxGeometry(movingBoxSize));
    }

    this.sphere.setRadius(sphereRadius).setOptions({fill: sphereFill});
    this.ptLight.setPosition(pointLightPosition).setColour(pointLightColour).setAttenuation(pointLightAtten);
    this.ambientLight.setColour(ambientLightColour);

    this.scene.addObject(this.ptLight);
    this.scene.addObject(this.movingBoxMesh);
    this.scene.addObject(this.boxMesh);
    this.scene.addObject(this.sphere);
    this.scene.addObject(this.ambientLight);

    super.setOptions(options);
  }

  async render(dt) {
    const {movingBoxSpeed, sphereSpeed} = this._options;

    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const RADIUS = halfXSize-2;

    const tBox = this.timeCounter*movingBoxSpeed;
    const tSphere = Math.PI + this.timeCounter*sphereSpeed;

    this.sphere.position.set((RADIUS)*Math.cos(tSphere) + halfXSize, halfYSize-1, (RADIUS)*Math.sin(tSphere) + halfZSize);
    this.sphere.makeDirty();

    this.movingBoxMesh.position.set((RADIUS)*Math.cos(tBox) + halfXSize, halfYSize-1, (RADIUS)*Math.sin(tBox) + halfZSize);
    _tempEuler.set(0, tBox/10.0, 0);
    this.movingBoxMesh.setRotationFromEuler(_tempEuler);
    this.movingBoxMesh.makeDirty();
    
    this.timeCounter += dt;

    await this.scene.render();
  }
}

export default ShadowScene;
