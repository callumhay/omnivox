import * as THREE from 'three';

import VoxelConstants from '../../VoxelConstants';
import {clamp} from '../../MathUtils';

import VTObject from '../VTObject';
import VTAmbientLight from '../VTAmbientLight';
import VTPointLight from '../VTPointLight';
import VTSpotLight from '../VTSpotLight';

import VTRenderProc from './VTRenderProc';
import VTRPMesh from './VTRPMesh';
import {VTRPFogBox, VTRPFogSphere} from './VTRPFog';
import VTRPVoxel from './VTRPVoxel';
import VTRPIsofield from './VTRPIsofield';


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
    this._tempVoxelMap = {};
  }

  render(renderableToVoxelMapping) {
    const result = [];
    const currVoxelPt = new THREE.Vector3();
    this._tempVoxelMap = {};

    Object.entries(renderableToVoxelMapping).forEach(entry => {
      const [id, voxelPts] = entry;
      const renderable = this.getRenderable(id);
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

  getRenderable(id) {
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
        case VTObject.SPOT_LIGHT_TYPE:
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
      case VTObject.SPOT_LIGHT_TYPE:
        buildFunc = VTSpotLight.build;
        break;
      case VTObject.VOXEL_TYPE:
        buildFunc = VTRPVoxel.build;
        break;
        
      case VTObject.FOG_BOX_TYPE:
        buildFunc = VTRPFogBox.build;
        break;
      case VTObject.FOG_SPHERE_TYPE:
        buildFunc = VTRPFogSphere.build;
        break;

      case VTObject.ISOFIELD_TYPE:
        buildFunc = VTRPIsofield.build;
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
      case VTObject.SPOT_LIGHT_TYPE:
        buildFunc = VTSpotLight.build;
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

  // Calculates the accumulated effect of shadow casters between the current voxel (point) and a light
  // given the direction and distance to that light.
  _calculateShadowCasterLightMultiplier(point, nToLightVec, distanceToLight) {
    let lightMultiplier = 1.0;
    
    // Check to see if the voxel is in shadow
    // NOTE: We currently only use point lights so there's only umbra shadow (no soft shadows/sampling)
    const shadowCasters = Object.values(this.shadowCasters);
    const raycaster = new THREE.Raycaster(point, nToLightVec, VoxelConstants.VOXEL_EPSILON, distanceToLight);
    for (let k = 0; k < shadowCasters.length && lightMultiplier > 0; k++) {
      const shadowCaster = shadowCasters[k];
      const shadowCasterResult = shadowCaster.calculateShadow(raycaster);
      if (shadowCasterResult.inShadow) {
        lightMultiplier -= shadowCasterResult.lightReduction;
      }
    }

    return lightMultiplier;
  }

  calculateVoxelLighting(point, material, receivesShadow) {
    // We treat voxels as perfect inifintesmial spheres centered at a given voxel position
    // they can be shadowed and have materials like meshes
    const finalColour = material.emission(null);
    
    const lights = Object.values(this.lights);
    if (lights.length > 0) {

      const nVoxelToLightVec = new THREE.Vector3();
      for (let j = 0; j < lights.length; j++) {
        const light = lights[j];

        nVoxelToLightVec.set(light.position.x, light.position.y, light.position.z);
        nVoxelToLightVec.sub(point);
        const distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, nVoxelToLightVec.length());
        nVoxelToLightVec.divideScalar(distanceToLight); // Normalize

        const lightMultiplier = receivesShadow ? this._calculateShadowCasterLightMultiplier(point, nVoxelToLightVec, distanceToLight) : 1.0;
        if (lightMultiplier > 0) {
          // The voxel is not in total shadow, do the lighting - since it's a "infitesimal sphere" the normal is always
          // in the direction of the light, so it's always ambiently lit (unless it's in shadow)
          const lightEmission = light.emission(point, distanceToLight).multiplyScalar(lightMultiplier);
          const materialLightingColour = material.brdfAmbient(null, lightEmission);
          finalColour.add(materialLightingColour);
        }
      }
    }

    if (this.ambientLight) {
      // Don't add ambient light more than once to the same voxel!
      const {x,y,z} = point;
      const voxelPtId = `${x}_${y}_${z}`;
      if (!(voxelPtId in this._tempVoxelMap)) { 
        finalColour.add(material.basicBrdfAmbient(null, this.ambientLight.emission()));
        this._tempVoxelMap[voxelPtId] = true;
      }
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));

    return finalColour;
  }

  calculateFogLighting(point) {
    const finalColour = new THREE.Color(0,0,0);
    const nLightToFogVec = new THREE.Vector3(0,0,0);

    const lights = Object.values(this.lights);
    if (lights.length > 0) {
      for (let j = 0; j < lights.length; j++) {
        const light = lights[j];

        // We use the light to the fog (and not vice versa) since the fog can't be inside objects
        nLightToFogVec.set(point.x, point.y, point.z);
        nLightToFogVec.sub(light.position);
        const distanceFromLight = Math.max(VoxelConstants.VOXEL_EPSILON, nLightToFogVec.length());
        nLightToFogVec.divideScalar(distanceFromLight);

        // Fog will not catch the light if it's behind or inside of an object...
        const lightMultiplier = this._calculateShadowCasterLightMultiplier(light.position, nLightToFogVec, distanceFromLight);
        if (lightMultiplier > 0) {
          const lightEmission = light.emission(point, distanceFromLight).multiplyScalar(lightMultiplier);
          finalColour.add(lightEmission);
        }
      }
      finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));
    }

    return finalColour;
  }

  calculateLightingSamples(samples, material, recievesShadows=true) {
    const finalColour = new THREE.Color(0,0,0);
    const sampleLightContrib = new THREE.Color(0,0,0);

    // Go through each light in the scene and raytrace to them...
    const nObjToLightVec = new THREE.Vector3(0,0,0);
    const factorPerSample = 1.0 / samples.length;
    const lights = Object.values(this.lights);
    
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

        const lightMultiplier = recievesShadows ? this._calculateShadowCasterLightMultiplier(point, nObjToLightVec, distanceToLight) : 1.0;
        if (lightMultiplier > 0) {
          // The voxel is not in total shadow, do the lighting
          const lightEmission = light.emission(point, distanceToLight).multiplyScalar(lightMultiplier*falloff);
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
        const {point, uv, falloff} = samples[i];

        // Don't add ambient light more than once to the same voxel!
        const {x,y,z} = point;
        const voxelPtId = `${x}_${y}_${z}`;
        if (!(voxelPtId in this._tempVoxelMap)) {
          sampleLightContrib.add(material.basicBrdfAmbient(uv, this.ambientLight.emission()).multiplyScalar(falloff));
          this._tempVoxelMap[voxelPtId] = true;
        }

      }
      sampleLightContrib.multiplyScalar(factorPerSample);
      finalColour.add(sampleLightContrib);
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));
    return finalColour;
  }

  

}

export default VTRPScene;