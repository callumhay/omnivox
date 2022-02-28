import * as THREE from 'three';

import VoxelConstants from '../../VoxelConstants';
import {clamp} from '../../MathUtils';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';

import VTObject from '../VTObject';
import VTAmbientLight from '../VTAmbientLight';
import VTPointLight from '../VTPointLight';
import VTSpotLight from '../VTSpotLight';

import VTRenderProc from './VTRenderProc';
import VTRPMesh from './VTRPMesh';
import VTRPSphere from './VTRPSphere';
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
    const currVoxelPt = new THREE.Vector3();
    const voxelDrawOrderMap = {};
    this._tempVoxelMap = {}; // Used to keep track of which voxels have already been ambient-lit

    Object.entries(renderableToVoxelMapping).forEach(entry => {
      const [id, voxelPts] = entry;
      const renderable = this.getRenderable(id);
      for (let i = 0; i < voxelPts.length; i++) {
        const {x,y,z} = voxelPts[i];
        currVoxelPt.set(x,y,z);

        const calcColour = renderable.calculateVoxelColour(currVoxelPt, this);

        if (calcColour.r > 0 || calcColour.g > 0 || calcColour.b > 0) {
          const voxelPtId = VoxelGeometryUtils.voxelFlatIdx(currVoxelPt, this.gridSize);
          if (!(voxelPtId in voxelDrawOrderMap)) {
            voxelDrawOrderMap[voxelPtId] = {drawOrder: renderable.drawOrder, colour: calcColour, point: currVoxelPt.clone()};
          }
          else {
            const currMapObj = voxelDrawOrderMap[voxelPtId];
            if (renderable.drawOrder > currMapObj.drawOrder) {
              currMapObj.drawOrder = renderable.drawOrder;
              currMapObj.colour = calcColour;
            }
            else if (renderable.drawOrder === currMapObj.drawOrder) {
              // Mix the colours together if the draw order is the same...
              currMapObj.colour.add(calcColour);
            }
          }
        }
      }
    });

    process.send({type: VTRenderProc.FROM_PROC_RENDERED, data: Object.values(voxelDrawOrderMap).map(v => ({pt: v.point, colour: v.colour})) });
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
        if (removedId in this.renderables) { delete this.renderables[removedId]; }
        if (removedId in this.lights) { delete this.lights[removedId]; }
        if (removedId in this.shadowCasters) { delete this.shadowCasters[removedId]; }
        if (this.ambientLight && this.ambientLight.id === removedId) { this.ambientLight = null; }
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
      case VTObject.SPHERE_TYPE:
        buildFunc = VTRPSphere.build;
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

  calculateVoxelLighting(voxelIdxPt, point, material, receivesShadow) {
    // We treat voxels as perfect inifintesmial spheres centered at a given voxel position
    // they can be shadowed and have materials like meshes
    const finalColour = material.emission(null);
    
    // Fast-out: If the final colour is already blown-out then there's no point rendering anything further
    if (finalColour.r < 1 || finalColour.g < 1 || finalColour.b < 1) {
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
        const voxelPtId = VoxelGeometryUtils.voxelFlatIdx(voxelIdxPt, this.gridSize);
        if (!(voxelPtId in this._tempVoxelMap)) { 
          finalColour.add(material.basicBrdfAmbient(null, this.ambientLight.emission()));
          this._tempVoxelMap[voxelPtId] = true;
        }
      }
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));

    return finalColour;
  }

  calculateFogLighting(point) {
    const finalColour = new THREE.Color(0,0,0);
    if (this.lights.length === 0) { return finalColour; }

    const nLightToFogVec = new THREE.Vector3(0,0,0);
    const lights = Object.values(this.lights);
    for (let j = 0; j < lights.length && (finalColour.r < 1 || finalColour.g < 1 || finalColour.b < 1); j++) {
      const light = lights[j];

      // We use the light to the fog (and not vice versa) since the fog can't be inside objects
      nLightToFogVec.set(point.x, point.y, point.z);
      nLightToFogVec.sub(light.position);
      const distanceFromLight = Math.max(VoxelConstants.VOXEL_EPSILON, nLightToFogVec.length());
      nLightToFogVec.divideScalar(distanceFromLight);

      // Fog will not catch the light if it's behind or inside of an object...
      const lightMultiplier = this._calculateShadowCasterLightMultiplier(light.position, nLightToFogVec, distanceFromLight);
      if (distanceFromLight > VoxelConstants.VOXEL_ERR_UNITS && lightMultiplier > 0) {
        const lightEmission = light.emission(point, distanceFromLight).multiplyScalar(lightMultiplier);
        finalColour.add(lightEmission);
      }
    }
    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));

    return finalColour;
  }

  calculateLightingSamples(voxelIdxPt, samples, material, recievesShadows=true) {
    const finalColour = new THREE.Color(0,0,0);
    const sampleLightContrib = new THREE.Color(0,0,0);

    // Go through each light in the scene and raytrace to them...
    const nObjToLightVec = new THREE.Vector3(0,0,0);
    const factorPerSample = 1.0 / samples.length;
    const lights = Object.values(this.lights);
    
    for (let i = 0; i < samples.length && (finalColour.r < 1 || finalColour.g < 1 || finalColour.b < 1); i++) {
      const {point, normal, uv, falloff} = samples[i];
      if (falloff === 0) { continue; }

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

    if (this.ambientLight && (finalColour.r < 1 || finalColour.g < 1 || finalColour.b < 1)) {
      // Don't add ambient light more than once to the same voxel!
      const voxelPtId = VoxelGeometryUtils.voxelFlatIdx(voxelIdxPt, this.gridSize);
      if (!(voxelPtId in this._tempVoxelMap)) {
        sampleLightContrib.set(0,0,0);
        for (let i = 0; i < samples.length; i++) {
          const {uv, falloff} = samples[i];
          sampleLightContrib.add(material.basicBrdfAmbient(uv, this.ambientLight.emission()).multiplyScalar(falloff));
        }
        sampleLightContrib.multiplyScalar(factorPerSample);
        finalColour.add(sampleLightContrib);

        this._tempVoxelMap[voxelPtId] = true;
      }
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));
    return finalColour;
  }

}

export default VTRPScene;