import * as THREE from 'three';

import VoxelConstants from '../../VoxelConstants';
import {clamp} from '../../MathUtils';

import VTObject from '../VTObject';
import VTAmbientLight from '../VTAmbientLight';
import VTPointLight from '../VTPointLight';

import VTRenderProc from './VTRenderProc';
import VTRPMesh from './VTRPMesh';
import VTRPFog from './VTRPFog';
import VTRPVoxel from './VTRPVoxel';

class VTRPScene {
  constructor() {
    this.gridSize = 0;
    this.clear();
  }

  dispose() {
    Object.values(this.renderables).forEach(renderable => {
      renderable.dispose();
    });
    this.clear();
  }

  clear() {
    // All renderables and lights are stored by their IDs
    this.renderables = {};
    this.lights = {};
    this.shadowCasters = {};
    this.ambientLight = null;
  }

  render(renderableToVoxelMapping) {
    const result = [];
    const currVoxelPt = new THREE.Vector3();
    Object.entries(renderableToVoxelMapping).forEach(entry => {
      const [id, voxelPts] = entry;
      const renderable = this._getRenderable(id);
      for (let i = 0; i < voxelPts.length; i++) {
        const {x,y,z} = voxelPts[i];
        currVoxelPt.set(x, y, z);
        const calcColour = renderable.calculateVoxelColour(currVoxelPt, this);
        if (calcColour.r > 0 || calcColour.g > 0 || calcColour.b > 0) {
          result.push({
            pt: currVoxelPt.clone(),
            colour: calcColour
          });
        }
      }
    });

    process.send({type: VTRenderProc.FROM_PROC_RENDERED, data: result});
  }

  _getRenderable(id) {
    let result = this.renderables[id];
    if (!result) { result = this.lights[id]; }
    return result;
  }

  update(sceneData) {
    const {removedIds, reinit, ambientLight, renderables, lights} = sceneData;

    if (reinit) {
      this.dispose();
    }
    else if (removedIds) {
      for (let i = 0; i < removedIds.length; i++) {
        const removedId = removedIds[i];
        delete this.renderables[removedId];
        delete this.lights[removedId];
        delete this.shadowCasters[removedId];
        if (this.ambientLight.id === removedId) {
          this.ambientLight = null;
        }
      }
    }

    if (ambientLight) {
      this.ambientLight = VTAmbientLight.build(ambientLight);
    }

    const updatedMap = {};
    if (renderables) {
      for (let i = 0; i < renderables.length; i++) {
        const renderableData = renderables[i];
        this._updateRenderable(renderableData, updatedMap);
      }
    }
    if (lights) {
      for (let i = 0; i < lights.length; i++) {
        const lightData = lights[i];
        this._updateLight(lightData, updatedMap);
      }
    }

    Object.entries(updatedMap).forEach(entry => {
      const [id, obj] = entry;

      if (id in this.renderables) {
        this.renderables[id].dispose();
      }
      else if (id in this.lights) {
        this.lights[id].dispose();
      }

      switch (obj.type) {
        case VTObject.POINT_LIGHT_TYPE:
          this.renderables[id] = obj;
          this.lights[id] = obj;
          break;
        default:
          this.renderables[id] = obj;
          if (obj.isShadowCaster()) {
            this.shadowCasters[id] = obj;
          }
          break;
      }
    });
  }

  _updateRenderable(renderableData, updatedMap) {
    const {id, type} = renderableData;
    if (id in updatedMap) {
      return;
    }

    let buildFunc = null;
    switch (type) {
      case VTObject.MESH_TYPE:
        buildFunc = VTRPMesh.build;
        break;
      case VTObject.POINT_LIGHT_TYPE:
        buildFunc = VTPointLight.build;
        break;
      case VTObject.VOXEL_TYPE:
        buildFunc = VTRPVoxel.build;
        break;
      case VTObject.FOG_TYPE:
        buildFunc = VTRPFog.build;
        break;

      default:
        console.error(`Unknown VTObject renderable type found: ${type}`);
        return;
    }

    updatedMap[id] = buildFunc(renderableData);
  }

  _updateLight(lightData, updatedMap) {
    const {id, type} = lightData;
    if (id in updatedMap) {
      return;
    }

    let buildFunc = null;
    switch (type) {
      case VTObject.POINT_LIGHT_TYPE:
        buildFunc = VTPointLight.build;
        break;

      case VTObject.AMBIENT_LIGHT_TYPE:
        this.ambientLight = VTAmbientLight.build(lightData);
        return;

      default:
        console.error(`Unknown VTObject light type found: ${type}`);
        return;
    }
    updatedMap[id] = buildFunc(lightData);
  }

  calculateVoxelLighting(point, material, receivesShadow) {
    // We treat voxels as perfect inifintesmial spheres centered at a given voxel position
    // they can be shadowed and have materials like meshes
    const finalColour = material.emission(null);
    
    const lights = Object.values(this.lights);
    if (lights.length > 0) {
      const nVoxelToLightVec = new THREE.Vector3();
      const raycaster = new THREE.Raycaster();

      for (let j = 0; j < lights.length; j++) {
        const light = lights[j];

        nVoxelToLightVec.set(light.position.x, light.position.y, light.position.z);
        nVoxelToLightVec.sub(point);
        const distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, nVoxelToLightVec.length());
        nVoxelToLightVec.divideScalar(distanceToLight);

        let lightMultiplier = 1.0;
        if (receivesShadow) {

          // Check to see if the voxel is in shadow
          // NOTE: We currently only use point lights so there's only umbra shadow (no soft shadows/sampling)
          raycaster.set(point, nVoxelToLightVec); 
          raycaster.near = VoxelConstants.VOXEL_EPSILON;
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

    const lights = Object.values(this.lights);
    if (lights.length > 0) {
      for (let j = 0; j < lights.length; j++) {
        const light = lights[j];

        nFogToLightVec.set(light.position.x, light.position.y, light.position.z);
        nFogToLightVec.sub(point);
        const distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, nFogToLightVec.length());
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
    const lights = Object.values(this.lights);
    const shadowCasters = Object.values(this.shadowCasters);

    for (let i = 0; i < samples.length; i++) {
      const {point, normal, uv, falloff} = samples[i];

      sampleLightContrib.copy(material.emission(uv));
      sampleLightContrib.multiplyScalar(falloff);

      for (let j = 0; j < lights.length; j++) {
        const light = lights[j];

        nObjToLightVec.set(light.position.x, light.position.y, light.position.z);
        nObjToLightVec.sub(point);
        const distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, nObjToLightVec.length());
        nObjToLightVec.divideScalar(distanceToLight);

        // Early out - is the light vector in the same hemisphere as the normal?
        if (nObjToLightVec.dot(normal) <= 0) {
          continue;
        }

        // Check to see if the surface is in shadow
        // NOTE: We currently only use point lights so there's only umbra shadow (no soft shadows/sampling)
        raycaster.set(point, nObjToLightVec); 
        raycaster.near = VoxelConstants.VOXEL_EPSILON;
        raycaster.far  = distanceToLight;

        let lightMultiplier = 1.0;
        
        for (let k = 0; k < shadowCasters.length; k++) {
          const shadowCaster = shadowCasters[k];
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
        sampleLightContrib.add(material.basicBrdfAmbient(uv, this.ambientLight.emission()).multiplyScalar(falloff));
      }
      sampleLightContrib.multiplyScalar(factorPerSample);
      finalColour.add(sampleLightContrib);
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));
    return finalColour;
  }

  

}

export default VTRPScene;