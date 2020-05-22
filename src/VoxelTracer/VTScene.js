import * as THREE from 'three';

import {VOXEL_EPSILON} from '../MathUtils';

import VTMesh from './VTMesh';
import VTLambertMaterial from './VTLambertMaterial';
import VTPointLight from './VTPointLight';
import VTAmbientLight from './VTAmbientLight';

const CLEAR_COLOUR = new THREE.Color(0,0,0);

class VTScene {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;

    // TODO: Octree... for faster ray collisions etc.
    this.renderables = [];
    this.shadowCasters = [];
    this.lights = [];

    this.ambientLight = null;
  }

  clear() {
    this.renderables.forEach(renderable => {
      renderable.dispose();
    });

    this.renderables = [];
    this.lights = [];
    this.shadowCasters = [];
    this.ambientLight = null;
  }

  addLight(l) {
    if (l instanceof VTAmbientLight) {
      this.ambientLight = l;
    }
    else {
      this.renderables.push(l);
      this.lights.push(l);
    }
  }
  addObject(o) {
    this.renderables.push(o);
    this.shadowCasters.push(o);
  }

  calculateLighting(point, normal, uv, material) {
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
        const materialLightingColour = material.brdf(nObjToLightVec, normal, uv, lightEmission);
        resultColour.add(materialLightingColour);
      }
    });

    if (this.ambientLight) {
      resultColour.add(material.brdfAmbient(uv, this.ambientLight.emission()));
    }

    return resultColour;
  }
  
  calculateLightingSamples(samples, material) {
    const finalColour = new THREE.Color(0,0,0);
    const sampleLightContrib = new THREE.Color(0,0,0);

    // Go through each light in the scene and raytrace to them...
    const nObjToLightVec = new THREE.Vector3(0,0,0);
    const raycaster = new THREE.Raycaster();
    const factorPerSample = 1.0 / samples.length;

    for (let i = 0; i < samples.length; i++) {
      const {point, normal, uv, falloff} = samples[i];

      sampleLightContrib.set(0,0,0);

      for (let j = 0; j < this.lights.length; j++) {
        const light = this.lights[j];

        nObjToLightVec.set(light.position.x, light.position.y, light.position.z);
        nObjToLightVec.sub(point);
        const distanceToLight = Math.max(VOXEL_EPSILON, nObjToLightVec.length() - VOXEL_EPSILON);
        nObjToLightVec.divideScalar(distanceToLight);

        // Early out - is the light vector in the same hemisphere as the normal?
        if (nObjToLightVec.dot(normal) <= 0) {
          continue;
        }

        // Check to see if the surface is in shadow
        // NOTE: We currently only use point lights so there's only umbra shadow (no soft shadows/sampling)
        raycaster.set(point, nObjToLightVec); 
        raycaster.near = VOXEL_EPSILON;
        raycaster.far  = distanceToLight;

        const intersectedObjects = this.intersectsShadowcasters(raycaster);
        if (intersectedObjects.length === 0) {

          // Not in shadow, do the lighting
          const lightEmission = light.emission(distanceToLight);
          const materialLightingColour = material.brdf(nObjToLightVec, normal, uv, lightEmission);
          sampleLightContrib.add(materialLightingColour.multiplyScalar(falloff));
        }
      }

      sampleLightContrib.multiplyScalar(factorPerSample);
      finalColour.add(sampleLightContrib);
    }

    if (this.ambientLight) {
      for (let i = 0; i < samples.length; i++) {
        const {uv} = samples[i];
        finalColour.add(material.brdfAmbient(uv, this.ambientLight.emission()).multiplyScalar(factorPerSample));
      }
    }

    return finalColour;
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

    /*
    // Show what voxels are being selected for rendering...
    visibleRenderables.forEach(renderable => {
      // Get all of the voxels that collide with the renderable object
      const voxelIndexPoints = renderable.getCollidingVoxels(this.voxelModel);
      voxelIndexPoints.forEach(pt => this.voxelModel.drawPoint(pt, new THREE.Color(1,1,1)));
    });
    */

    visibleRenderables.forEach(renderable => {
      // Get all of the voxels that collide with the renderable object
      const voxelIndexPoints = renderable.getCollidingVoxels(this.voxelModel);
      voxelIndexPoints.forEach(voxelIdxPt => {
        
        const voxelObj = this.voxelModel.getVoxel(voxelIdxPt);
        if (voxelObj) {
          // Map the index point into the centroid of the voxel in worldspace
          //const wsVoxelCentroid = this.voxelModel.getVoxelWorldSpaceCentroid(voxelIdxPt);
          const calcColour = renderable.calculateVoxelColour(voxelIdxPt, this);
          voxelObj.addColour(calcColour);
        }
      });
    });

  }
  
}

export default VTScene;