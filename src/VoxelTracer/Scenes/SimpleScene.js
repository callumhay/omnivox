
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
    this.prevTextureFilename = "";
  }

  build(options) {
    const {wallX, wallY, wallZ} = options;

    if (!this._objectsBuilt) {
      const {
        sphereRadius, sphereColour,
        ambientLightColour, 
        pointLight1Colour, pointLight2Colour, pointLight3Colour, pointLightAtten, 
        textureFilename,
        wallColour,
      } = options;

      this.sphereGeometry = new THREE.SphereBufferGeometry(sphereRadius, 20, 20);
      this.sphereGeometry.translate(this.voxelModel.xSize()/2, this.voxelModel.ySize()/2, this.voxelModel.zSize()/2);

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
      else {
        this.sphereTexture = null;
      }

      this.sphereMesh = new VTMesh(this.sphereGeometry, new VTLambertMaterial(new THREE.Color(sphereColour.r, sphereColour.g, sphereColour.b), this.crossfadeAlpha, this.sphereTexture || null));
      this.ptLight1 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight1Colour.r, pointLight1Colour.g, pointLight1Colour.b).multiplyScalar(this.crossfadeAlpha), {...pointLightAtten});
      this.ptLight2 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight2Colour.r, pointLight2Colour.g, pointLight2Colour.b).multiplyScalar(this.crossfadeAlpha), {...pointLightAtten});
      this.ptLight3 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(pointLight3Colour.r, pointLight3Colour.g, pointLight3Colour.b).multiplyScalar(this.crossfadeAlpha), {...pointLightAtten});
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b).multiplyScalar(this.crossfadeAlpha));

      const size = this.voxelModel.xSize();
      const halfXSize = this.voxelModel.xSize()/2;
      const halfYSize = this.voxelModel.ySize()/2;
      const halfZSize = this.voxelModel.zSize()/2;
  
      if (wallX) {
        this.wallXGeometry = new THREE.BoxBufferGeometry(1,size,size);
        this.wallXGeometry.translate(0, halfYSize, halfZSize);
        this.wallXMesh = new VTMesh(this.wallXGeometry, new VTLambertMaterial(new THREE.Color(wallColour.r, wallColour.g, wallColour.b), this.crossfadeAlpha));
      }
      if (wallY) {
        this.wallYGeometry = new THREE.BoxBufferGeometry(size,1,size);
        this.wallYGeometry.translate(halfXSize, 0, halfZSize);
        this.wallYMesh = new VTMesh(this.wallYGeometry, new VTLambertMaterial(new THREE.Color(wallColour.r, wallColour.g, wallColour.b), this.crossfadeAlpha));
      }
      if (wallZ) {
        this.wallZGeometry = new THREE.BoxBufferGeometry(size,size,1);
        this.wallZGeometry.translate(halfXSize, halfYSize, 0);
        this.wallZMesh = new VTMesh(this.wallZGeometry, new VTLambertMaterial(new THREE.Color(wallColour.r, wallColour.g, wallColour.b), this.crossfadeAlpha));
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

  render(dt) {
    if (!this._objectsBuilt) {
      return;
    }

    const {pointLightsSpd, sphereRadius} = this._options;

    // Move lights around in circles...
    const halfXSize = this.voxelModel.xSize()/2;
    const halfYSize = this.voxelModel.ySize()/2;
    const halfZSize = this.voxelModel.zSize()/2;
    const lightMovementRadius = sphereRadius + 1;

    const t = this.timeCounter*pointLightsSpd;

    this.ptLight1.position.set(lightMovementRadius*Math.cos(t) + halfXSize, halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);
    this.ptLight2.position.set(halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, lightMovementRadius*Math.sin(t) + halfZSize);
    this.ptLight3.position.set(lightMovementRadius*Math.sin(t) + halfXSize, lightMovementRadius*Math.cos(t) + halfYSize, halfZSize);

    this.scene.render();

    this.timeCounter += dt;
  }

  crossfade(alpha) {
    super.crossfade(alpha);

    const {
      ambientLightColour, 
      pointLight1Colour, pointLight2Colour, pointLight3Colour,
    } = this._options;

    this.sphereMesh.material.alpha = alpha;
    if (this.wallXMesh) { this.wallXMesh.material.alpha = alpha; }
    if (this.wallYMesh) { this.wallYMesh.material.alpha = alpha; }
    if (this.wallZMesh) { this.wallZMesh.material.alpha = alpha; }

    this.ptLight1.colour.setRGB(pointLight1Colour.r, pointLight1Colour.g, pointLight1Colour.b).multiplyScalar(alpha);
    this.ptLight2.colour.setRGB(pointLight2Colour.r, pointLight2Colour.g, pointLight2Colour.b).multiplyScalar(alpha);
    this.ptLight3.colour.setRGB(pointLight3Colour.r, pointLight3Colour.g, pointLight3Colour.b).multiplyScalar(alpha);
    this.ambientLight.colour.setRGB(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b).multiplyScalar(alpha);
  }
}

export default SimpleScene;