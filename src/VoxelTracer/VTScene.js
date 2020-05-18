
import * as THREE from 'three';

import {VOXEL_EPSILON} from '../MathUtils';

import VTMesh from './VTMesh';
import VTLambertMaterial from './VTLambertMaterial';
import VTPointLight from './VTPointLight';

const CLEAR_COLOUR = new THREE.Color(0,0,0);

class VTScene {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;

    // TODO: Octree... for faster ray collisions etc.
    this.renderables = [];
    this.shadowCasters = [];
    this.lights = [];

    // Setup a basic scene...
    // NOTE: All geometry must be buffer geometry!
    const sphereGeometry = new THREE.SphereBufferGeometry(2, 20, 20);
    sphereGeometry.translate(voxelModel.xSize()/2, voxelModel.ySize()/2, voxelModel.zSize()/2);

    const sphereMesh = new VTMesh(sphereGeometry, new VTLambertMaterial());
    const ptLight1 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(1,0,0), {quadratic: 0, linear:3, constant:0});
    const ptLight2 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(0,1,0), {quadratic: 0, linear:3, constant:0});
    const ptLight3 = new VTPointLight(new THREE.Vector3(0,0,0), new THREE.Color(0,0,1), {quadratic: 0, linear:3, constant:0});

    this.addLight(ptLight1);
    this.addLight(ptLight2);
    this.addLight(ptLight3);
    this.addObject(sphereMesh);

    this.timeCounter = 0;
  }

  addLight(l) {
    this.renderables.push(l);
    this.lights.push(l);
  }
  addObject(o) {
    this.renderables.push(o);
    this.shadowCasters.push(o);
  }

  calculateLighting(point, normal, material) {
    const resultColour = new THREE.Color(0,0,0);

    // Go through each light in the scene and raytrace to them...
    const nObjToLightVec = new THREE.Vector3(0,0,0);
    const raycaster = new THREE.Raycaster(point);

    this.lights.forEach(light => {
      nObjToLightVec.set(light.position.x, light.position.y, light.position.z);
      nObjToLightVec.sub(point);
      const distanceToLight = Math.max(VOXEL_EPSILON, nObjToLightVec.length());
      nObjToLightVec.divideScalar(distanceToLight);

      // Check to see if the surface is in shadow
      // NOTE: We currently only use point lights so there's only umbra shadow (no soft shadows/sampling)
      raycaster.ray.direction = nObjToLightVec;
      raycaster.near = VOXEL_EPSILON;
      raycaster.far  = distanceToLight;
      const intersectedObjects = this.intersectsShadowcasters(raycaster);
      if (intersectedObjects.length === 0) {
        // Not in shadow, do the lighting
        const lightEmission = light.emission(distanceToLight);
        const materialLightingColour = material.brdf(nObjToLightVec, normal, lightEmission);
        resultColour.add(materialLightingColour);
      }
    });

    return resultColour;
  }

  intersectsShadowcasters(raycaster) {
    // TODO: Acceleration structure (BVH/Octree) !!!
    const result = [];
    this.shadowCasters.forEach(shadowCaster => {
      if (shadowCaster.intersectsRay(raycaster)) {
        result.push(shadowCaster);
      }
    });
    return result;
  }

  render(dt) {
    // move the light around in a circle...
    const RADIUS = this.voxelModel.xSize()/2;
    const ANGULAR_VEL = Math.PI;
    const t = this.timeCounter*ANGULAR_VEL;
    this.lights[0].position.set((RADIUS-1)*Math.cos(t)+RADIUS, RADIUS, (RADIUS-1)*Math.sin(t)+RADIUS);
    this.lights[1].position.set(RADIUS, (RADIUS-1)*Math.cos(t)+RADIUS, (RADIUS-1)*Math.sin(t)+RADIUS);
    this.lights[2].position.set((RADIUS-1)*Math.sin(t)+RADIUS, (RADIUS-1)*Math.cos(t)+RADIUS, RADIUS);

    // Clear all voxels to black/off
    this.voxelModel.clear(CLEAR_COLOUR);

    // Find all renderable entities that exist within the bounds of the voxels (i.e., visible entities)
    const voxelBoundingBox = this.voxelModel.getBoundingBox();
    const visibleRenderables = [];
    this.renderables.forEach(renderable => {
      if (renderable.intersectsBox(voxelBoundingBox)) {
        visibleRenderables.push(renderable);
      }
    });

    visibleRenderables.forEach(renderable => {
      // Get all of the voxels that collide with the renderable object
      const voxelPoints = renderable.getCollidingVoxels(this.voxelModel);
      voxelPoints.forEach(voxelPt => {
        const voxelObj = this.voxelModel.getVoxel(voxelPt);
        if (voxelObj) {
          const calcColour = renderable.calculateVoxelColour(voxelPt, this);
          voxelObj.addColour(calcColour);
        }
      });
    });
    this.timeCounter += dt;
  }
  
}

export default VTScene;