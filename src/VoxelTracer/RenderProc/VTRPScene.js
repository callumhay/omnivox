import * as THREE from 'three';

import VoxelConstants from '../../VoxelConstants';
import VoxelGeometryUtils from '../../VoxelGeometryUtils';
import ColourRGBA from '../../ColourRGBA';

import VTConstants from '../VTConstants';

import VTRenderProc from './VTRenderProc';
import VTPool from '../VTPool';
import VTRPObjectFactory from './VTRPObjectFactory';

const _currVoxelIdxPt = new THREE.Vector3();
const _currVoxelColourRGBA = new ColourRGBA();

const _lightEmission = new THREE.Color(0,0,0);
const _materialLightingRGBA = new ColourRGBA(0,0,0,0);
const _sampleLightContribRGBA = new ColourRGBA(0,0,0,0);

const _nLightToFogVec = new THREE.Vector3(0,0,0);
const _nObjToLightVec = new THREE.Vector3(0,0,0);
const _nVoxelToLightVec = new THREE.Vector3();

class VTRPScene {
  constructor() {
    this.gridSize = 0;
    
    // All renderables, lights, and shadowcasters are stored by their IDs
    this.renderables = {};
    this.lights = {};
    this.shadowCasters = {};
    this.ambientLight = null;

    this._tempVoxelMap = {}; // Used during rendering to keep track of voxels that have had ambient light applied to them

    // Initialize our object pool (to avoid excessive memory allocation during rendering)
    this.pool = new VTPool();
    // Preload objects into the pool - this will keep our first render from stuttering due to memory alloc
    VTRPObjectFactory.preloadSceneObjects(this.pool);
  }

  clear() {
    // IMPORTANT: Make sure we don't reclaim the same object more than once - use a map to track them!
    // (since renderables and lights can share the same objects)
    const reclaimedObjs = {};

    // Reclaim all objects in the pool
    for (const [id, renderable] of Object.entries(this.renderables)) {
      renderable.expire(this.pool);
      this.pool.expire(renderable);
      reclaimedObjs[renderable.id] = true;
      delete this.renderables[id];
    }

    for (const [id, light] of Object.entries(this.lights)) {
      if (!(light.id in reclaimedObjs)) {
        light.expire(this.pool);
        this.pool.expire(light);
        reclaimedObjs[light.id] = true;
      }
      delete this.lights[id];
    }

    if (this.ambientLight) {
      this.ambientLight.expire(this.pool);
      this.pool.expire(this.ambientLight);
      this.ambientLight = null;
    }
    
    this.shadowCasters = {}; // Shadowcasters will have already been reclaimed via renderables and lights
    this._tempVoxelMap = {};
  }

  render(renderableToVoxelMapping) {
    
    const voxelDrawOrderMap = {};
    this._tempVoxelMap = {}; // Used to keep track of which voxels have already been ambient-lit
    
    for (const [id, voxelPts] of Object.entries(renderableToVoxelMapping)) {
      const renderable = this.getRenderable(id);
      for (let i = 0; i < voxelPts.length; i++) {

        const {x,y,z} = voxelPts[i];
        _currVoxelIdxPt.set(x,y,z);
        _currVoxelColourRGBA.setRGBA(0,0,0,0);

        renderable.calculateVoxelColour(_currVoxelColourRGBA, _currVoxelIdxPt, this);

        if (_currVoxelColourRGBA.a <= 0) { continue; } // Fast-out if we can't see this voxel
        _currVoxelColourRGBA.a = THREE.MathUtils.clamp(_currVoxelColourRGBA.a, 0, 1); // Clamp alpha to [0,1] before blending!

        const voxelPtId = VoxelGeometryUtils.voxelFlatIdx(_currVoxelIdxPt, this.gridSize);
        if (!(voxelPtId in voxelDrawOrderMap)) {
          voxelDrawOrderMap[voxelPtId] = {
            drawOrder: renderable.drawOrder, 
            colourRGBA: _currVoxelColourRGBA.clone(), 
            point: _currVoxelIdxPt.clone(),
          };
        }
        else {
          const currMapObj = voxelDrawOrderMap[voxelPtId];
          // Blend the voxel's colour based on the draw order and the alpha of the colours in the voxel
          if (renderable.drawOrder === currMapObj.drawOrder) {
            // Same draw order: Equally blend the two voxels based on their alphas
            const {colourRGBA} = currMapObj;
            colourRGBA.setRGBA(
              colourRGBA.r*colourRGBA.a + _currVoxelColourRGBA.r*_currVoxelColourRGBA.a,
              colourRGBA.g*colourRGBA.a + _currVoxelColourRGBA.g*_currVoxelColourRGBA.a,
              colourRGBA.b*colourRGBA.a + _currVoxelColourRGBA.b*_currVoxelColourRGBA.a,
              Math.min(1, colourRGBA.a + _currVoxelColourRGBA.a)
            );
          }
          else if (renderable.drawOrder > currMapObj.drawOrder) {
            currMapObj.drawOrder = renderable.drawOrder;
            // The voxel currently has a lower draw order than what we're rendering,
            // use the alpha of what we're rendering to determine the blend
            const {colourRGBA} = currMapObj;
            const blendAlpha = _currVoxelColourRGBA.a;
            const oneMinusBlendAlpha = 1-blendAlpha;
            colourRGBA.setRGBA(
              colourRGBA.r*oneMinusBlendAlpha + _currVoxelColourRGBA.r*blendAlpha,
              colourRGBA.g*oneMinusBlendAlpha + _currVoxelColourRGBA.g*blendAlpha,
              colourRGBA.b*oneMinusBlendAlpha + _currVoxelColourRGBA.b*blendAlpha,
              colourRGBA.a*oneMinusBlendAlpha + _currVoxelColourRGBA.a*blendAlpha
            );
          }
          else {
            // The voxel currently has a higher draw order than what was rendered,
            // use the alpha of what was rendered to determine the blend
            const {colourRGBA} = currMapObj;
            const blendAlpha = colourRGBA.a;
            const oneMinusBlendAlpha = 1-blendAlpha;
            colourRGBA.setRGBA(
              _currVoxelColourRGBA.r*oneMinusBlendAlpha + colourRGBA.r*blendAlpha,
              _currVoxelColourRGBA.g*oneMinusBlendAlpha + colourRGBA.g*blendAlpha,
              _currVoxelColourRGBA.b*oneMinusBlendAlpha + colourRGBA.b*blendAlpha,
              _currVoxelColourRGBA.a*oneMinusBlendAlpha + colourRGBA.a*blendAlpha
            );
          }
        }
      }
    }

    // TODO: Remove the clamp and create a blowout attribute if we're doing bloom
    process.send({
      type: VTRenderProc.FROM_PROC_RENDERED, 
      data: Object.values(voxelDrawOrderMap).map(v => ({
        pt: v.point, colour: v.colourRGBA.clampRGBA(0,1).multiplyScalar(v.colourRGBA.a)
      })),
    });
  }

  getRenderable(id) {
    let result = this.renderables[id];
    if (!result) { result = this.lights[id]; }
    return result;
  }

  update(sceneData) {
    const {removedIds, reinit, ambientLight, renderables, lights} = sceneData;

    if (reinit) { this.clear(); }
    else if (removedIds) {
      for (let i = 0, numIds = removedIds.length; i < numIds; i++) {
        const removedId = removedIds[i];
        if (removedId in this.renderables) {
          const renderable = this.renderables[removedId];
          renderable.expire(this.pool);
          this.pool.expire(renderable);
          delete this.renderables[removedId];

          // A renderable may also be a light
          if (removedId in this.lights) {
            delete this.lights[removedId];
          }
          // ... and can also be a shadowcaster
          if (removedId in this.shadowCasters) {
            delete this.shadowCasters[removedId]; // No need to expire shadowcasters, they've already been taken care of by the renderables
          } 
        }
        else if (removedId in this.lights) {
          const light = this.lights[removedId];
          light.expire(this.pool);
          this.pool.expire(light);
          delete this.lights[removedId];
        }
        else if (this.ambientLight && this.ambientLight.id === removedId) {
          this.ambientLight.expire(pool);
          this.pool.expire(this.ambientLight);
          this.ambientLight = null;
        }
      }
    }

    if (ambientLight) {
      this.ambientLight = VTRPObjectFactory.updateOrBuildFromPool(ambientLight, this.pool, this.ambientLight);
    }

    const updatedMap = {};
    const updateSceneFromObjJson = ((objJson) => {
      const {id} = objJson;
      if (id in updatedMap) { return; }

      const prevObj = this.lights[id] || this.renderables[id];
      const obj =  VTRPObjectFactory.updateOrBuildFromPool(objJson, this.pool, prevObj);
      if (!obj) { console.error("Uninitialized object found, this shouldn't happen."); }

      const isRenderableObj = VTRPObjectFactory.isRenderable(objJson);
      if (isRenderableObj) {
        this.renderables[id] = obj;
        if (obj.isShadowCaster()) { this.shadowCasters[id] = obj; }
      }
      const isLightObj = VTRPObjectFactory.isLight(objJson, false);
      if (isLightObj) {
        this.lights[id] = obj;
      }
      updatedMap[id] = obj;

    }).bind(this);

    if (renderables) {
      for (const renderableJson of renderables) { updateSceneFromObjJson(renderableJson); }
    }

    if (lights) {
      for (const lightJson of lights) { updateSceneFromObjJson(lightJson); }
    }
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

  calculateVoxelLighting(targetRGBA, voxelIdxPt, point, material, receivesShadows) {
    // We treat voxels as perfect inifintesmial spheres centered at a given voxel position
    // they can be shadowed and have materials like meshes
    material.emission(targetRGBA);

    let distanceToLight = 0;
    const lights = Object.values(this.lights);

    for (let j = 0, numLights = lights.length; j < numLights; j++) {
      const light = lights[j];
      
      switch (light.type) {
        case VTConstants.DIRECTIONAL_LIGHT_TYPE:
          // If we're dealing with a directional light then the voxel to light vector is always the same
          // i.e., it's the negative direction of the directional light
          distanceToLight  = 100*VoxelConstants.VOXEL_GRID_SIZE; // Significantly larger than the voxel grid
          _nVoxelToLightVec.set(-light.direction.x, -light.direction.y, -light.direction.z);
          break;

        case VTConstants.POINT_LIGHT_TYPE:
        case VTConstants.SPOT_LIGHT_TYPE:
          _nVoxelToLightVec.set(light.position.x, light.position.y, light.position.z);
          _nVoxelToLightVec.sub(point);
          distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, _nVoxelToLightVec.length());
          _nVoxelToLightVec.divideScalar(distanceToLight); // Normalize
          break;

        default:
          continue;
      }

      const lightMultiplier = receivesShadows ? this._calculateShadowCasterLightMultiplier(point, _nVoxelToLightVec, distanceToLight) : 1.0;
      if (lightMultiplier > 0) {
        // The voxel is not in total shadow, do the lighting - since it's a "infitesimal sphere" the normal is always
        // in the direction of the light, so it's always ambiently lit (unless it's in shadow)
        light.emission(_lightEmission, point, distanceToLight).multiplyScalar(lightMultiplier);
        material.brdfAmbient(_materialLightingRGBA, null, _lightEmission);
        targetRGBA.add(_materialLightingRGBA);
      }
    }

    if (this.ambientLight) {
      // Don't add ambient light more than once to the same voxel!
      const voxelPtId = VoxelGeometryUtils.voxelFlatIdx(voxelIdxPt, this.gridSize);
      if (!(voxelPtId in this._tempVoxelMap)) { 
        this.ambientLight.emission(_lightEmission);
        material.basicBrdfAmbient(_materialLightingRGBA, null, _lightEmission)
        targetRGBA.add(_materialLightingRGBA);
        this._tempVoxelMap[voxelPtId] = true;
      }
    }
 
    targetRGBA.a = material.alpha;
    return targetRGBA;
  }

  calculateLightingSamples(targetRGBA, voxelIdxPt, samples, material, receivesShadows=true, factorPerSample=null) {  
    let distanceToLight = 0;
    const oneOverNumSamples = (1.0 / samples.length);
    factorPerSample = factorPerSample || oneOverNumSamples;
    const lights = Object.values(this.lights);
    const numSamples = samples.length;
    
    for (let i = 0; i < numSamples; i++) {
      const {point, normal, uv, falloff} = samples[i];

      material.emission(_sampleLightContribRGBA, uv);
      _sampleLightContribRGBA.multiplyScalar(falloff*oneOverNumSamples);

      for (let j = 0, numLights = lights.length; j < numLights; j++) {
        const light = lights[j];

        switch (light.type) {
          case VTConstants.DIRECTIONAL_LIGHT_TYPE:
            // If we're dealing with a directional light then the voxel to light vector is always the same
            // i.e., it's the negative direction of the directional light
            distanceToLight  = 100*VoxelConstants.VOXEL_GRID_SIZE; // Significantly larger than the voxel grid
            _nObjToLightVec.set(-light.direction.x, -light.direction.y, -light.direction.z);
            break;
  
          case VTConstants.POINT_LIGHT_TYPE:
          case VTConstants.SPOT_LIGHT_TYPE:
            _nObjToLightVec.set(light.position.x, light.position.y, light.position.z);
            _nObjToLightVec.sub(point);
            distanceToLight = Math.max(VoxelConstants.VOXEL_EPSILON, _nObjToLightVec.length());
            _nObjToLightVec.divideScalar(distanceToLight);
            break;
  
          default:
            continue;
        }

        // Early out - is the light vector in the same hemisphere as the normal?
        if (_nObjToLightVec.dot(normal) <= 0) { continue; }

        const lightMultiplier = receivesShadows ? this._calculateShadowCasterLightMultiplier(point, _nObjToLightVec, distanceToLight) : 1.0;
        if (lightMultiplier > 0) {
          // The voxel is not in total shadow, do the lighting
          light.emission(_lightEmission, point, distanceToLight).multiplyScalar(lightMultiplier*falloff);
          material.brdf(_materialLightingRGBA, _nObjToLightVec, normal, uv, _lightEmission);
          _sampleLightContribRGBA.add(_materialLightingRGBA.multiplyScalar(falloff));
        }
      }

      _sampleLightContribRGBA.multiplyScalar(factorPerSample);
      targetRGBA.add(_sampleLightContribRGBA);
    }

    if (this.ambientLight) {
      // Don't add ambient light more than once to the same voxel!
      const voxelPtId = VoxelGeometryUtils.voxelFlatIdx(voxelIdxPt, this.gridSize);
      if (!(voxelPtId in this._tempVoxelMap)) {
        _sampleLightContribRGBA.setRGBA(0,0,0,0);
        for (let i = 0; i < numSamples; i++) {
          const {uv, falloff} = samples[i];
          this.ambientLight.emission(_lightEmission)
          material.basicBrdfAmbient(_materialLightingRGBA, uv, _lightEmission).multiplyScalar(falloff);
          _sampleLightContribRGBA.add(_materialLightingRGBA);
        }

        _sampleLightContribRGBA.multiplyScalar(1.0 / samples.length);
        targetRGBA.add(_sampleLightContribRGBA);

        this._tempVoxelMap[voxelPtId] = true;
      }
    }

    targetRGBA.a = material.alpha;
    return targetRGBA;
  }

  calculateFogLighting(targetRGBA, point) {
    if (this.lights.length === 0) { return targetRGBA; }

    const lights = Object.values(this.lights);
    for (let j = 0, numLights = lights.length; j < numLights; j++) {
      const light = lights[j];

      if (light.type === VTConstants.DIRECTIONAL_LIGHT_TYPE) { continue; } // Directional lights don't affect fog for now

      // We use the light to the fog (and not vice versa) since the fog can't be inside objects
      _nLightToFogVec.set(point.x, point.y, point.z);
      _nLightToFogVec.sub(light.position);
      const distanceFromLight = Math.max(VoxelConstants.VOXEL_EPSILON, _nLightToFogVec.length());
      _nLightToFogVec.divideScalar(distanceFromLight);

      // Fog will not catch the light if it's behind or inside of an object...
      const lightMultiplier = this._calculateShadowCasterLightMultiplier(light.position, _nLightToFogVec, distanceFromLight);
      if (lightMultiplier > 0) {
        light.emission(_lightEmission, point, distanceFromLight);
        targetRGBA.add(_lightEmission);
        targetRGBA.a += lightMultiplier;
      }
    }

    return targetRGBA;
  }

}

export default VTRPScene;