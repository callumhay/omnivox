
import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';
import VTSphere from '../VTSphere';

import VoxelModel from '../../Server/VoxelModel';
import VoxelPostProcessPipeline from '../../Server/PostProcess/VoxelPostProcessPipeline';
import VoxelDistortionPP from '../../Server/PostProcess/VoxelDistortionPP';

const _tempVec3_0 = new THREE.Vector3();

class SimpleScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;

    this.postProcessPipeline = new VoxelPostProcessPipeline(voxelModel);
    this.distortion = new VoxelDistortionPP(voxelModel);
    this.postProcessPipeline.addPostProcess(this.distortion);
  }

  load() {
    const size = this.voxelModel.xSize();
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;

    this.sphere = new VTSphere(null, 1, new VTLambertMaterial());

    this.wallXMesh = new VTMesh(new THREE.BoxBufferGeometry(1,size,size), new VTLambertMaterial());
    this.wallXMesh.position.set(0, halfYSize, halfZSize);
    this.wallYMesh = new VTMesh(new THREE.BoxBufferGeometry(size,1,size), new VTLambertMaterial());
    this.wallYMesh.position.set(halfXSize, 0, halfZSize);
    this.wallZMesh = new VTMesh(new THREE.BoxBufferGeometry(size,size,1), new VTLambertMaterial());
    this.wallZMesh.position.set(halfXSize, halfYSize, 0);

    this.ptLight1 = new VTPointLight();
    this.ptLight2 = new VTPointLight();
    this.ptLight3 = new VTPointLight();
    this.ambientLight = new VTAmbientLight();

    this.timeCounter = 0;
  }
  unload() {
    this.sphere = null;
    this.wallXMesh = null; this.wallYMesh = null; this.wallZMesh = null;
    this.ptLight1 = null; this.ptLight2 = null; this.ptLight3 = null;
    this.ambientLight = null;
  }

  setOptions(options) {
    super.setOptions(options);

    const {
      noiseAlpha, noiseSpeed, distortHorizontal, distortVertical,
      wallX, wallY, wallZ, wallColour,
      sphereRadius, sphereColour, sphereEmission, sphereFill,
      ambientLightColour, pointLight1Colour, pointLight2Colour, pointLight3Colour, pointLightAtten, 
    } = options;

    _tempVec3_0.set(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);
    this.sphere.setCenter(_tempVec3_0).setRadius(sphereRadius).setOptions({fill: sphereFill});
    this.sphere.material.colour.copy(sphereColour);
    this.sphere.material.emissive.copy(sphereEmission);

    this.ptLight1.setColour(pointLight1Colour).setAttenuation(pointLightAtten);
    this.ptLight2.setColour(pointLight2Colour).setAttenuation(pointLightAtten);
    this.ptLight3.setColour(pointLight3Colour).setAttenuation(pointLightAtten);

    this.ambientLight.setColour(ambientLightColour);

    this.distortion.setConfig({noiseAlpha, noiseSpeed, distortHorizontal, distortVertical});

    this.scene.addObject(this.ptLight1);
    this.scene.addObject(this.ptLight2);
    this.scene.addObject(this.ptLight3);
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
  }

  async render(dt) {
    const {pointLightsSpd, sphereRadius} = this._options;

    // Move lights around in circles...
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const lightMovementRadius = sphereRadius + (this.voxelModel.xSize()-2 - 2*sphereRadius)/2;

    const t = this.timeCounter*pointLightsSpd;

    this.ptLight1.position.set(lightMovementRadius*Math.cos(t) + halfXSize, halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);
    this.ptLight1.makeDirty();

    this.ptLight2.position.set(halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);
    this.ptLight2.makeDirty();

    this.ptLight3.position.set(lightMovementRadius*Math.sin(t) + halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, halfZSize);
    this.ptLight3.makeDirty();
    
    this.timeCounter += dt;

    await this.scene.render();
    this.postProcessPipeline.render(dt, VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }
}

export default SimpleScene;