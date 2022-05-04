

import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTAmbientLight from '../VTAmbientLight';
import VTVoxel from '../VTVoxel';
import VTEmissionMaterial from '../VTEmissionMaterial';
import VTLambertMaterial from '../VTLambertMaterial';

import VTPEmitterManager from '../Particles/VTPEmitterManager';
import VTPEmitter from '../Particles/VTPEmitter';
import VTPRate from '../Particles/VTPRate';
import VTPSpan from '../Particles/VTPSpan';
import {VTPBoxZone} from '../Particles/VTPZones';
import {StaticDirGenerator, UniformSphereDirGenerator, VTPBody, VTPLife, VTPPosition, VTPVelocity} from '../Particles/VTPInitializers';
import VTPAlpha from '../Particles/Behaviours/VTPAlpha';
import VTPColour from '../Particles/Behaviours/VTPColour';

import VoxelModel from '../../Server/VoxelModel';
import VoxelPostProcessPipeline from '../../Server/PostProcess/VoxelPostProcessPipeline';
import VoxelGaussianBlurPP from '../../Server/PostProcess/VoxelGaussianBlurPP';
import VoxelChromaticAberrationPP from '../../Server/PostProcess/VoxelChromaticAberrationPP';


class ParticleScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;

    this.postProcessPipeline = new VoxelPostProcessPipeline(voxelModel);

    this.gaussianBlur = new VoxelGaussianBlurPP(voxelModel);
    this.postProcessPipeline.addPostProcess(this.gaussianBlur);

    this.chromaticAberration = new VoxelChromaticAberrationPP(voxelModel);
    this.postProcessPipeline.addPostProcess(this.chromaticAberration);
  }

  clear() {
    super.clear();
    this.timeCounter = 0;
    this._objectsBuilt = false;
  }

  build(options) {
    if (!options) { return; }
    
    if (!this._objectsBuilt) {

      const {
        blurKernelSize, blurSqrSigma, blurConserveEnergy, 
        chromaticAberrationIntensity, chromaticAberrationAlpha, chromaticAberrationOffsets,
        particleMaterial, particleSpawn, particleLifeSpan, particleSpeed, 
        particleAlphaStart, particleAlphaEnd, particleColourStart, particleColourEnd,
        emitterType, emitterPos, totalEmitTimes
      } = options;

      const materialNameToClass = {
        "VTEmissionMaterial" : VTEmissionMaterial,
        "VTLambertMaterial"  : VTLambertMaterial,
      };

      this.emitter = new VTPEmitter();
      this.emitter.rate = new VTPRate(new VTPSpan(particleSpawn.numMin, particleSpawn.numMax), particleSpawn.interval);
      this.emitter.addInitializer(new VTPBody(VTVoxel, materialNameToClass[particleMaterial]));
      this.emitter.addInitializer(new VTPLife(particleLifeSpan.min, particleLifeSpan.max));

      const speedSpan = new VTPSpan(particleSpeed.min, particleSpeed.max);
      switch (emitterType) {
        case 'point':
        default:
          this.emitter.addInitializer(new VTPVelocity(speedSpan, new UniformSphereDirGenerator()));
          this.emitter.p.set(emitterPos.x, emitterPos.y, emitterPos.z);
          break;
        case 'box': {
          const {gridSize} = this.voxelModel;
          this.emitter.addInitializer(new VTPVelocity(speedSpan, new StaticDirGenerator([new THREE.Vector3(0,1,0)])));
          this.emitter.addInitializer(new VTPPosition(
            new VTPBoxZone(new THREE.Vector3(0,0,0), new THREE.Vector3(gridSize, 1, gridSize))
          ));
          break;
        }
      }
      
      this.emitter.addBehaviour(new VTPAlpha(new VTPSpan(particleAlphaStart.min, particleAlphaStart.end), new VTPSpan(particleAlphaEnd.min, particleAlphaEnd.max)));
      this.emitter.addBehaviour(new VTPColour(['mix', particleColourStart.colourA, particleColourStart.colourB], ['mix', particleColourEnd.colourA, particleColourEnd.colourB]));
      this.emitter.startEmit(totalEmitTimes.isInfinity ? Infinity : totalEmitTimes.num);
      
      this.emitterMgr = new VTPEmitterManager(this.scene, 20, [VTVoxel]);
      this.emitterMgr.addEmitter(this.emitter);

      const ambientLightColour = options.ambientLightColour ? options.ambientLightColour : fogDefaultOptions.ambientLightColour;
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

      this.gaussianBlur.setConfig({
        kernelSize: blurKernelSize,
        sqrSigma: blurSqrSigma,
        conserveEnergy: blurConserveEnergy
      });
      this.chromaticAberration.setConfig({
        intensity: chromaticAberrationIntensity,
        alpha: chromaticAberrationAlpha,
        xyzMask: [chromaticAberrationOffsets.x, chromaticAberrationOffsets.y, chromaticAberrationOffsets.z]
      });

      this._objectsBuilt = true;
    }
    else {
      this.fog.options = fogOptions;
    }

    this.scene.addObject(this.ambientLight);
  }

  async render(dt) {
    if (!this._objectsBuilt) {
      return;
    }
    const debugDt = Math.min(0.1, dt);
    this.timeCounter += debugDt;
    this.emitterMgr.tick(debugDt);
    
    await this.scene.render();

    this.postProcessPipeline.render(dt, VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }

}

export default ParticleScene;