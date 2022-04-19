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
import VTDirectionalLight from '../VTDirectionalLight';
import VTRPBox from './VTRPBox';
import VTConstants from '../VTConstants';


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
    this.shadowCasters = {};

    this.lights = {};
    this.ambientLight = null;
    
    this._tempVoxelMap = {};
  }

  render(renderableToVoxelMapping) {
    const currVoxelPt = new THREE.Vector3();
    const voxelDrawOrderMap = {};
    this._tempVoxelMap = {}; // Used to keep track of which voxels have already been ambient-lit

    for (const [id, voxelPts] of Object.entries(renderableToVoxelMapping)) {
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
              const {colour} = currMapObj;
              colour.add(calcColour);
              colour.setRGB(Math.min(1,colour.r), Math.min(1,colour.g), Math.min(1,colour.b));
            }
          }
        }
      }
    }

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

        case VTConstants.POINT_LIGHT_TYPE:
        case VTConstants.SPOT_LIGHT_TYPE:
          this.renderables[id] = obj;
          this.lights[id] = obj;
          break;

        case VTConstants.DIRECTIONAL_LIGHT_TYPE:
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
      case VTConstants.MESH_TYPE:
        buildFunc = VTRPMesh.build;
        break;
      case VTConstants.SPHERE_TYPE:
        buildFunc = VTRPSphere.build;
        break;
      case VTConstants.BOX_TYPE:
        buildFunc = VTRPBox.build;
        break;

      case VTConstants.POINT_LIGHT_TYPE:
        buildFunc = VTPointLight.build;
        break;
      case VTConstants.SPOT_LIGHT_TYPE:
        buildFunc = VTSpotLight.build;
        break;
      case VTConstants.DIRECTIONAL_LIGHT_TYPE:
        buildFunc = VTDirectionalLight.build;
        break;
        
      case VTConstants.VOXEL_TYPE:
        buildFunc = VTRPVoxel.build;
        break;
        
      case VTConstants.FOG_BOX_TYPE:
        buildFunc = VTRPFogBox.build;
        break;
      case VTConstants.FOG_SPHERE_TYPE:
        buildFunc = VTRPFogSphere.build;
        break;

      case VTConstants.ISOFIELD_TYPE:
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

      case VTConstants.POINT_LIGHT_TYPE:
        buildFunc = VTPointLight.build;
        break;
      case VTConstants.SPOT_LIGHT_TYPE:
        buildFunc = VTSpotLight.build;
        break;
      case VTConstants.DIRECTIONAL_LIGHT_TYPE:
        buildFunc = VTDirectionalLight.build;
        break;

      case VTConstants.AMBIENT_LIGHT_TYPE:
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

  calculateVoxelLighting(voxelIdxPt, point, material, receivesShadows) {
    // We treat voxels as perfect inifintesmial spheres centered at a given voxel position
    // they can be shadowed and have materials like meshes
    const finalColour = material.emission(null);
    const lights = Object.values(this.lights);
    const nVoxelToLightVec = new THREE.Vector3();
    let distanceToLight = 0;
    for (let j = 0; j < lights.length && (finalColour.r < 1 || finalColour.g < 1 || finalColour.b < 1); j++) {
      const light = lights[j];
      
      switch (light.type) {
        case VTConstants.DIRECTIONAL_LIGHT_TYPE:
          // If we're dealing with a directional light then the voxel to light vector is always the same
          // i.e., it's the negative direction of the directional light
          distanceToLight  = 100*VoxelConstants.VOXEL_GRID_SIZE; // Significantly larger than the voxel grid
          nVoxelToLightVec.set(-light.direction.x, -light.direction.y, -light.direction.z);
          break;

        case VTConstants.POINT_LIGHT_TYPE:
        case VTConstants.SPOT_LIGHT_TYPE:
          nVoxelToLightVec.set(light.position.x, light.position.y, light.position.z);
          nVoxelToLightVec.sub(point);
          distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, nVoxelToLightVec.length());
          nVoxelToLightVec.divideScalar(distanceToLight); // Normalize
          break;

        default:
          continue;
      }

      const lightMultiplier = receivesShadows ? this._calculateShadowCasterLightMultiplier(point, nVoxelToLightVec, distanceToLight) : 1.0;
      if (lightMultiplier > 0) {
        // The voxel is not in total shadow, do the lighting - since it's a "infitesimal sphere" the normal is always
        // in the direction of the light, so it's always ambiently lit (unless it's in shadow)
        const lightEmission = light.emission(point, distanceToLight).multiplyScalar(lightMultiplier);
        const materialLightingColour = material.brdfAmbient(null, lightEmission);
        finalColour.add(materialLightingColour);
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

      if (light.type === VTConstants.DIRECTIONAL_LIGHT_TYPE) { continue; } // Directional lights don't affect fog for now

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

    return finalColour;
  }

  calculateLightingSamples(voxelIdxPt, samples, material, receivesShadows=true, factorPerSample=null) {
    const finalColour = new THREE.Color(0,0,0);
    const sampleLightContrib = new THREE.Color(0,0,0);

    // Go through each light in the scene and raytrace to them...
    const nObjToLightVec = new THREE.Vector3(0,0,0);
    let distanceToLight = 0;
    factorPerSample = factorPerSample || (1.0 / samples.length);
    const lights = Object.values(this.lights);
    
    for (let i = 0; i < samples.length && (finalColour.r < 1 || finalColour.g < 1 || finalColour.b < 1); i++) {
      const {point, normal, uv, falloff} = samples[i];
      if (falloff === 0) { continue; }

      sampleLightContrib.copy(material.emission(uv));
      sampleLightContrib.multiplyScalar(falloff);

      for (let j = 0; j < lights.length && (sampleLightContrib.r < 1 || sampleLightContrib.g < 1 || sampleLightContrib.b < 1); j++) {
        const light = lights[j];

        switch (light.type) {
          case VTConstants.DIRECTIONAL_LIGHT_TYPE:
            // If we're dealing with a directional light then the voxel to light vector is always the same
            // i.e., it's the negative direction of the directional light
            distanceToLight  = 100*VoxelConstants.VOXEL_GRID_SIZE; // Significantly larger than the voxel grid
            nObjToLightVec.set(-light.direction.x, -light.direction.y, -light.direction.z);
            break;
  
          case VTConstants.POINT_LIGHT_TYPE:
          case VTConstants.SPOT_LIGHT_TYPE:
            nObjToLightVec.set(light.position.x, light.position.y, light.position.z);
            nObjToLightVec.sub(point);
            distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, nObjToLightVec.length());
            nObjToLightVec.divideScalar(distanceToLight);
            break;
  
          default:
            continue;
        }

        // Early out - is the light vector in the same hemisphere as the normal?
        if (nObjToLightVec.dot(normal) <= 0) { continue; }

        const lightMultiplier = receivesShadows ? this._calculateShadowCasterLightMultiplier(point, nObjToLightVec, distanceToLight) : 1.0;
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
        sampleLightContrib.multiplyScalar(1.0 / samples.length);
        finalColour.add(sampleLightContrib);

        this._tempVoxelMap[voxelPtId] = true;
      }
    }

    finalColour.setRGB(clamp(finalColour.r, 0, 1), clamp(finalColour.g, 0, 1), clamp(finalColour.b, 0, 1));
    return finalColour;
  }

}

export default VTRPScene;