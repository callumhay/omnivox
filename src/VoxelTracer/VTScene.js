import * as THREE from 'three';

import {VOXEL_EPSILON, clamp} from '../MathUtils';
import VTAmbientLight from './VTAmbientLight';

class VTScene {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;

    // TODO: Octree... for faster ray collisions etc.
    this.renderables = [];
    this.shadowCasters = [];
    this.lights = [];

    this.ambientLight = null;
  }

  dispose() {
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
  addFog(f) {
    this.addObject(f);
  }

  removeObject(o) {
    let index = this.renderables.indexOf(o);
    if (index > -1) {
      this.renderables.splice(index, 1);
    }
    index = this.shadowCasters.indexOf(o);
    if (index > -1) {
      this.shadowCasters.splice(index, 1);
    }
  }

  calculateVoxelLighting(point, material, receivesShadow) {
    // We treat voxels as perfect inifintesmial spheres centered at a given voxel position
    // they can be shadowed and have materials like meshes
    const finalColour = material.emission(null);
    
    if (this.lights.length > 0) {
      const nVoxelToLightVec = new THREE.Vector3();
      const raycaster = new THREE.Raycaster();

      for (let j = 0; j < this.lights.length; j++) {
        const light = this.lights[j];

        nVoxelToLightVec.set(light.position.x, light.position.y, light.position.z);
        nVoxelToLightVec.sub(point);
        const distanceToLight = Math.max(VOXEL_EPSILON, nVoxelToLightVec.length());
        nVoxelToLightVec.divideScalar(distanceToLight);

        let lightMultiplier = 1.0;
        if (receivesShadow) {

          // Check to see if the voxel is in shadow
          // NOTE: We currently only use point lights so there's only umbra shadow (no soft shadows/sampling)
          raycaster.set(point, nVoxelToLightVec); 
          raycaster.near = VOXEL_EPSILON;
          raycaster.far  = distanceToLight;

          for (let k = 0; k < this.shadowCasters.length; k++) {
            const shadowCaster = this.shadowCasters[k];
            const shadowCasterResult = shadowCaster.calculateShadow(raycaster);
            if (shadowCasterResult.inShadow) {
              lightMultiplier -= shadowCasterResult.lightReduction;
            }
          }
        }

        if (lightMultiplier > 0) {
          // The voxel is not in total shadow, do the lighting - since it's a "infitesimal sphere" the normal is always
          // in the direction of the light, so it's always ambiently lit (unless it's in shadow)
          const lightEmission = light.emission(distanceToLight).multiplyScalar(lightMultiplier);
          const materialLightingColour = material.brdfAmbient(null, lightEmission);
          finalColour.add(materialLightingColour);
        }
      }
    }

    if (this.ambientLight) {
      finalColour.add(material.basicBrdfAmbient(null, this.ambientLight.emission()));
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));

    return finalColour;
  }

  calculateFogLighting(point) {
    const finalColour = new THREE.Color(0,0,0);
    const nFogToLightVec = new THREE.Vector3(0,0,0);

    if (this.lights.length > 0) {
      for (let j = 0; j < this.lights.length; j++) {
        const light = this.lights[j];

        nFogToLightVec.set(light.position.x, light.position.y, light.position.z);
        nFogToLightVec.sub(point);
        const distanceToLight = Math.max(VOXEL_EPSILON, nFogToLightVec.length());
        const lightEmission = light.emission(distanceToLight);
        finalColour.add(lightEmission);
      }
      finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));
    }

    return finalColour;
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

      sampleLightContrib.copy(material.emission(uv));

      for (let j = 0; j < this.lights.length; j++) {
        const light = this.lights[j];

        nObjToLightVec.set(light.position.x, light.position.y, light.position.z);
        nObjToLightVec.sub(point);
        const distanceToLight = Math.max(VOXEL_EPSILON, nObjToLightVec.length());
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

        let lightMultiplier = 1.0;
        
        for (let k = 0; k < this.shadowCasters.length; k++) {
          const shadowCaster = this.shadowCasters[k];
          const shadowCasterResult = shadowCaster.calculateShadow(raycaster);
          if (shadowCasterResult.inShadow) {
            lightMultiplier -= shadowCasterResult.lightReduction;
          }
        }

        if (lightMultiplier > 0) {
          // The voxel is not in total shadow, do the lighting
          const lightEmission = light.emission(distanceToLight).multiplyScalar(lightMultiplier*falloff);
          const materialLightingColour = material.brdf(nObjToLightVec, normal, uv, lightEmission);
          sampleLightContrib.add(materialLightingColour.multiplyScalar(falloff));
        }
      }
      sampleLightContrib.multiplyScalar(factorPerSample);
      finalColour.add(sampleLightContrib);
    }

    if (this.ambientLight) {
      sampleLightContrib.set(0,0,0);
      for (let i = 0; i < samples.length; i++) {
        const {uv, falloff} = samples[i];
        sampleLightContrib.add(material.basicBrdfAmbient(uv, this.ambientLight.emission()).multiplyScalar(falloff*factorPerSample));
      }
      finalColour.add(sampleLightContrib);
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));
    return finalColour;
  }

  render() {
    // Find all renderable entities that exist within the bounds of the voxels (i.e., visible entities)
    const voxelBoundingBox = this.voxelModel.getBoundingBox();
    const visibleRenderables = [];
    for (let i = 0; i < this.renderables.length; i++) {
      const renderable = this.renderables[i];
      if (renderable.intersectsBox(voxelBoundingBox)) {
        visibleRenderables.push(renderable);
      }
    }

    /*
    // Show what voxels are being selected for rendering...
    visibleRenderables.forEach(renderable => {
      // Get all of the voxels that collide with the renderable object
      const voxelIndexPoints = renderable.getCollidingVoxels();
      voxelIndexPoints.forEach(pt => this.voxelModel.drawPoint(pt, new THREE.Color(1,1,1)));
    });
    */

    for (let i = 0; i < visibleRenderables.length; i++) {
      const renderable = visibleRenderables[i];

      // Get all of the voxels that collide with the renderable object
      const voxelIndexPoints = renderable.getCollidingVoxels();
      for (let j = 0; j < voxelIndexPoints.length; j++) {
        const voxelIdxPt = voxelIndexPoints[j];
        const voxelObj = this.voxelModel.getVoxel(voxelIdxPt);
        if (voxelObj) {
          // Map the index point into the centroid of the voxel in worldspace
          //const wsVoxelCentroid = this.voxelModel.calcVoxelWorldSpaceCentroid(voxelIdxPt);
          const calcColour = renderable.calculateVoxelColour(voxelIdxPt, this);
          voxelObj.addColour(calcColour);
        }
      }
    }
  }

  
}

export default VTScene;