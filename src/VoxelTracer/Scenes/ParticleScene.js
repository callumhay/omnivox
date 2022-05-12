

import * as THREE from 'three';

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
import VTPAttraction from '../Particles/Behaviours/VTPAttraction';

import VoxelModel from '../../Server/VoxelModel';
import VoxelPostProcessPipeline from '../../Server/PostProcess/VoxelPostProcessPipeline';
import VoxelGaussianBlurPP from '../../Server/PostProcess/VoxelGaussianBlurPP';
import VoxelChromaticAberrationPP from '../../Server/PostProcess/VoxelChromaticAberrationPP';

import SceneRenderer from './SceneRenderer';
import VTPEase from '../Particles/VTPEase';

class ParticleScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
  }

  load() {
    const {gridSize} = this.voxelModel;

    this.postProcessPipeline = new VoxelPostProcessPipeline(this.voxelModel);
    this.gaussianBlur = new VoxelGaussianBlurPP(this.voxelModel);
    this.postProcessPipeline.addPostProcess(this.gaussianBlur);
    this.chromaticAberration = new VoxelChromaticAberrationPP(this.voxelModel);
    this.postProcessPipeline.addPostProcess(this.chromaticAberration);

    this.emitter = new VTPEmitter();
    
    this.spawnNum      = new VTPSpan();
    this.spawnInterval = new VTPSpan();
    this.emitter.rate  = new VTPRate(this.spawnNum, this.spawnInterval);

    this.emitterBodyInit = new VTPBody(VTVoxel, VTEmissionMaterial);
    this.emitter.addInitializer(this.emitterBodyInit);
    this.emitterLifeInit = new VTPLife();
    this.emitter.addInitializer(this.emitterLifeInit);

    this.speedSpan = new VTPSpan();
    this.boxDirGen = new StaticDirGenerator([new THREE.Vector3(0,1,0)]);
    this.sphereDirGen = new UniformSphereDirGenerator();
    this.emitterVelInit = new VTPVelocity(this.speedSpan, this.sphereDirGen);
    this.emitter.addInitializer(this.emitterVelInit);

    this.boxPosInit = new VTPPosition(new VTPBoxZone(new THREE.Vector3(0,0,0), new THREE.Vector3(gridSize, 1, gridSize)));

    this.alphaBehaviour = new VTPAlpha();
    this.emitter.addBehaviour(this.alphaBehaviour);

    this.particleStartColourA = new THREE.Color();
    this.particleStartColourB = new THREE.Color();
    this.particleEndColourA   = new THREE.Color();
    this.particleEndColourB   = new THREE.Color();
    this.emitter.addBehaviour(new VTPColour(
      ['mix', this.particleStartColourA, this.particleStartColourB],
      ['mix', this.particleEndColourA, this.particleEndColourB]
    ));

    this.particleAttractBehaviour = new VTPAttraction();

    this.emitterMgr = new VTPEmitterManager(this.scene, 20, [VTVoxel]);
    this.emitterMgr.addEmitter(this.emitter);

    this.ambientLight = new VTAmbientLight();
  }
  unload() {
    this.postProcessPipeline = null;
    this.gaussianBlur = null;
    this.chromaticAberration = null;
    this.emitter = null;
    this.spawnNum = null; this.spawnInterval = null;
    this.speedSpan = null;
    this.emitterBodyInit = null;
    this.emitterLifeInit = null;
    this.emitterVelInit = null;
    this.boxPosInit = null; 
    this.boxDirGen = null; this.sphereDirGen = null;
    this.alphaBehaviour = null;
    this.particleStartColourA = null; this.particleStartColourB = null;
    this.particleEndColourA = null; this.particleEndColourB = null;
    this.particleAttractBehaviour = null;
    this.emitterMgr = null;
    this.ambientLight = null;
  }

  setOptions(options) {
    const {
      blurKernelSize, blurSqrSigma, blurConserveEnergy, 
      chromaticAberrationIntensity, chromaticAberrationAlpha, chromaticAberrationOffsets,
      particleMaterial, particleSpawn, particleLifeSpan, particleSpeed, 
      particleAlphaStart, particleAlphaEnd, particleAlphaEasing, particleColourStart, particleColourEnd,
      emitterType, emitterPos, totalEmitTimes, ambientLightColour,
      enableAttractor, attractorForce, attractorRadius, attractorPos,
    } = options;

    const materialNameToClass = {
      "VTEmissionMaterial" : VTEmissionMaterial,
      "VTLambertMaterial"  : VTLambertMaterial,
    };

    this.spawnNum.a = particleSpawn.numMin; this.spawnNum.b = particleSpawn.numMax;
    this.spawnInterval.a = this.spawnInterval.b =  particleSpawn.interval;
    this.emitterBodyInit.materialType = materialNameToClass[particleMaterial];
    this.emitterLifeInit.lifeSpan.a = particleLifeSpan.min;
    this.emitterLifeInit.lifeSpan.b = particleLifeSpan.max;

    this.speedSpan.a = particleSpeed.min; this.speedSpan.b = particleSpeed.max;
    this.emitter.removeInitializer(this.boxPosInit);
    switch (emitterType) {
      case 'point':
      default:
        this.emitterVelInit.dirGenerator = this.sphereDirGen;
        this.emitter.p.set(emitterPos.x, emitterPos.y, emitterPos.z);
        break;
      case 'box': {
        this.emitterVelInit.dirGenerator = this.boxDirGen;
        this.emitter.addInitializer(this.boxPosInit);
        break;
      }
    }

    this.alphaBehaviour.reset(
      new VTPSpan(particleAlphaStart.min, particleAlphaStart.max),
      new VTPSpan(particleAlphaEnd.min, particleAlphaEnd.max),
      null, VTPEase[particleAlphaEasing]
    );

    this.particleStartColourA.copy(particleColourStart.colourA);
    this.particleStartColourB.copy(particleColourStart.colourB);
    this.particleEndColourA.copy(particleColourEnd.colourA);
    this.particleEndColourB.copy(particleColourEnd.colourB);

    if (!this._options || !this._options.totalEmitTimes || 
        totalEmitTimes.isInfinity !== this._options.totalEmitTimes.isInfinity || 
        totalEmitTimes.num !== this._options.totalEmitTimes.num) {

      this.emitter.startEmit(totalEmitTimes.isInfinity ? Infinity : totalEmitTimes.num);
    }
    if (enableAttractor) {
      this.particleAttractBehaviour.reset(attractorPos, attractorForce, attractorRadius);
      this.emitter.addBehaviour(this.particleAttractBehaviour);
    }
    else {
      this.emitter.removeBehaviour(this.particleAttractBehaviour);
    }

    this.ambientLight.setColour(ambientLightColour);

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

    this.scene.addObject(this.ambientLight);
    super.setOptions(options);
  }

  async render(dt) {
    this.emitterMgr.tick(dt);
    await this.scene.render();
    this.postProcessPipeline.render(dt, VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }

}

export default ParticleScene;
