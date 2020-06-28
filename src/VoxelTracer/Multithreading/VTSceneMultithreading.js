import * as THREE from 'three';
import os from 'os';

import {VOXEL_EPSILON, clamp} from '../../MathUtils';
import VTMeshMultithreading from './VTMeshMultithreading';

export class VTSceneMultithreading {
  constructor(vtSceneModel) {
    this.renderables = [];
    this.shadowCasters = [];

    for (let i = 0; i < vtSceneModel.renderables.length; i++) {
      const renderable = vtSceneModel.renderables[i];
      if (renderable instanceof VTMesh) {
        const mtMesh = new VTMeshMultithreading(renderable);
        this.renderables.push(mtMesh);
        this.shadowCasters.push(mtMesh)
      }
      else {
        this.renderables.push(renderable);
      }
    }

    this.lights = vtSceneModel.lights;
    this.ambientLight = vtSceneModel.ambientLight;
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
}

class VTSceneMultithreading {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;
    this.sceneModel = new VTSceneModel();

    // Create a thread pool based on the number of cpu cores on this machine
    const cpuCount = os.cpus().length;
    console.log("Initializing thread pool, size: " + cpuCount + "...");
    this.threadPool = new DynamicPool(cpuCount);
  }

  dispose() {
    this.sceneModel.dispose();
  }

  addLight(l) {
    this.sceneModel.addLight(l);
  }
  addObject(o) {
    this.sceneModel.addObject(o);
  }
  addFog(f) {
    this.sceneModel.addFog(f);
  }
  removeObject(o) {
    this.sceneModel.removeObject(o);
  }

  render() {
    // Get a list of every voxel that will need to be rendered
    const renderData = this.sceneModel.calculateRenderData(this.voxelModel);

    // Split up the voxels evenly among threads
    const numThreads = os.cpus().length;
    const chunkSize = renderData.length / numThreads;
    const splitArrayIntoChunks = (array, chunk_size) => 
      Array(Math.ceil(array.length / chunk_size)).fill().map((_, index) => index * chunk_size).map(begin => array.slice(begin, begin + chunk_size));
    const chunkedRenderData = splitArrayIntoChunks(renderData, chunkSize);

    //console.log(chunkedRenderData);

    const sceneModelMT = new VTSceneModelMultithreading(this.sceneModel);


    for (let i = 0; i < chunkedRenderData.length; i++) {
      (async () => {
        const currRenderData = chunkedRenderData[i];
        const result = await this.threadPool.exec({
          task: threadMain,
          workerData: {
            sceneModel: sceneModelMT,
            renderData: currRenderData,
          },
        });
        
        // The result will be a list of colours that correspond to the given render data
        for (let j = 0; j < result.length; j++) {
          const {voxelObj} = currRenderData[j];
          voxelObj.addColour(result[j]);
        }
      })();
    }
  }
}

export default VTSceneMultithreading;
