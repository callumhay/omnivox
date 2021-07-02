
import * as THREE from 'three';
import fs from 'fs';

import SceneRenderer from './SceneRenderer';

import VTMesh from '../VTMesh';
import VTLambertMaterial from '../VTLambertMaterial';
import VTPointLight from '../VTPointLight';
import VTAmbientLight from '../VTAmbientLight';
import VTTexture from '../VTTexture';

class SimpleScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
  }

  clear() {
    super.clear();
    this._objectsBuilt = false;
  }

  build(options) {
    const {wallX, wallY, wallZ} = options;

    if (!this._objectsBuilt) {
      const {
        sphereRadius, sphereColour, sphereEmission,
        ambientLightColour, 
        pointLight1Colour, pointLight2Colour, pointLight3Colour, pointLightAtten, 
        wallColour,
      } = options;

      this.sphereTexture = null;
      /*
      if (textureFilename.length > 0) {
        let textureFilepath = "dist/textures/" + textureFilename;
        if (textureFilepath !== this.prevTextureFilename) {
          this.sphereTexture = null;
          if (fs.existsSync(textureFilepath)) {
            this.sphereTexture = new VTTexture(textureFileToUse);
            this.prevTextureFilename = textureFileToUse;
          }
        }
      }
      */

      this.sphereGeometry = new THREE.SphereBufferGeometry(sphereRadius, 20, 20);
      this.sphereMesh = new VTMesh(this.sphereGeometry, new VTLambertMaterial(new THREE.Color(sphereColour.r, sphereColour.g, sphereColour.b), 
        new THREE.Color(sphereEmission.r, sphereEmission.g, sphereEmission.b), 1, this.sphereTexture || null));
      this.sphereMesh.setPosition(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);

      this.ptLight1 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight1Colour.r, pointLight1Colour.g, pointLight1Colour.b), {...pointLightAtten});
      this.ptLight2 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight2Colour.r, pointLight2Colour.g, pointLight2Colour.b), {...pointLightAtten});
      this.ptLight3 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight3Colour.r, pointLight3Colour.g, pointLight3Colour.b), {...pointLightAtten});
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      const size = this.voxelModel.xSize();
      const halfXSize = this.voxelModel.xSize()/2;
      const halfYSize = this.voxelModel.ySize()/2;
      const halfZSize = this.voxelModel.zSize()/2;
  
      if (wallX) {
        this.wallXGeometry = new THREE.BoxBufferGeometry(1,size,size);
        this.wallXMesh = new VTMesh(this.wallXGeometry, new VTLambertMaterial(new THREE.Color(wallColour.r, wallColour.g, wallColour.b)));
        this.wallXMesh.setPosition(0, halfYSize, halfZSize);
      }
      if (wallY) {
        this.wallYGeometry = new THREE.BoxBufferGeometry(size,1,size);
        this.wallYMesh = new VTMesh(this.wallYGeometry, new VTLambertMaterial(new THREE.Color(wallColour.r, wallColour.g, wallColour.b)));
        this.wallYMesh.setPosition(halfXSize, 0, halfZSize);
      }
      if (wallZ) {
        this.wallZGeometry = new THREE.BoxBufferGeometry(size,size,1);
        this.wallZMesh = new VTMesh(this.wallZGeometry, new VTLambertMaterial(new THREE.Color(wallColour.r, wallColour.g, wallColour.b)));
        this.wallZMesh.setPosition(halfXSize, halfYSize, 0);
      }

      this._objectsBuilt = true;
    }

    this.scene.addLight(this.ptLight1);
    this.scene.addLight(this.ptLight2);
    this.scene.addLight(this.ptLight3);
    this.scene.addLight(this.ambientLight);
    this.scene.addObject(this.sphereMesh);

    if (wallX) {
      this.scene.addObject(this.wallXMesh);
    }
    if (wallY) {
      this.scene.addObject(this.wallYMesh);
    }
    if (wallZ) {
      this.scene.addObject(this.wallZMesh);
    }
  }

  async render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const {pointLightsSpd, sphereRadius} = this._options;

    // Move lights around in circles...
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const lightMovementRadius = sphereRadius + (this.voxelModel.xSize()-2 - 2*sphereRadius)/2;

    const t = this.timeCounter*pointLightsSpd;

    this.ptLight1.setPosition(this.ptLight1.position.set(lightMovementRadius*Math.cos(t) + halfXSize, halfYSize, lightMovementRadius*Math.sin(t) + halfZSize));
    this.ptLight2.setPosition(this.ptLight2.position.set(halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, lightMovementRadius*Math.sin(t) + halfZSize));
    this.ptLight3.setPosition(this.ptLight3.position.set(lightMovementRadius*Math.sin(t) + halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, halfZSize));
    
    this.timeCounter += dt;

    await this.scene.render();
  }
}

export default SimpleScene;