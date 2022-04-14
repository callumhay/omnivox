

import * as THREE from 'three';

import SceneRenderer from './SceneRenderer';

import VTAmbientLight from '../VTAmbientLight';
import VTVoxel from '../VTVoxel';

import VTPEmitterManager from '../Particles/VTPEmitterManager';
import VTPEmitter from '../Particles/VTPEmitter';
import VTPRate from '../Particles/VTPRate';
import VTPSpan from '../Particles/VTPSpan';
import { UniformSphereDirGenerator, VTPBody, VTPLife, VTPVelocity } from '../Particles/Initializers/VTPInitializers';
import VTPAlpha from '../Particles/Behaviours/VTPAlpha';
import VTPColour from '../Particles/Behaviours/VTPColour';
import VTEmissionMaterial from '../VTEmissionMaterial';

class ParticleScene extends SceneRenderer {
  constructor(scene, voxelModel) {
    super(scene, voxelModel);
    this._objectsBuilt = false;
  }

  clear() {
    super.clear();
    this.timeCounter = 0;
    this._objectsBuilt = false;
  }

  build(options) {
    if (!this._objectsBuilt) {

      const halfGridDist = (this.voxelModel.gridSize/2) - 0.5;

      const {
        totalEmitTimes, particleSpawn, particleLifeSpan, particleSpeed, 
        particleAlphaStart, particleAlphaEnd, particleColourStart, particleColourEnd
      } = options;

      // Setup a super basic emitter
      this.emitter = new VTPEmitter();
      this.emitter.rate = new VTPRate(new VTPSpan(particleSpawn.numMin, particleSpawn.numMax), particleSpawn.interval);
      this.emitter.addInitializer(new VTPBody(VTVoxel, VTEmissionMaterial));
      this.emitter.addInitializer(new VTPLife(particleLifeSpan.min, particleLifeSpan.max));
      this.emitter.addInitializer(new VTPVelocity(new VTPSpan(particleSpeed.min, particleSpeed.max), new UniformSphereDirGenerator()));
      this.emitter.addBehaviour(new VTPAlpha(new VTPSpan(particleAlphaStart.min, particleAlphaStart.end), new VTPSpan(particleAlphaEnd.min, particleAlphaEnd.max)));
      this.emitter.addBehaviour(new VTPColour(['mix', particleColourStart.colourA, particleColourStart.colourB], ['mix', particleColourEnd.colourA, particleColourEnd.colourB]));
      this.emitter.p.set(halfGridDist,halfGridDist,halfGridDist);
      this.emitter.emit(totalEmitTimes.isInfinity ? Infinity : totalEmitTimes.num);
      
      this.emitterMgr = new VTPEmitterManager(this.scene);
      this.emitterMgr.addEmitter(this.emitter);

      const ambientLightColour = options.ambientLightColour ? options.ambientLightColour : fogDefaultOptions.ambientLightColour;
      this.ambientLight = new VTAmbientLight(new THREE.Color(ambientLightColour.r, ambientLightColour.g, ambientLightColour.b));

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
  }
}

export default ParticleScene;