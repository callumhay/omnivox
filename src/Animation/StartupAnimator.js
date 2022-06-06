import * as THREE from 'three';
import {animate, anticipate, bounceInOut, easeInOut, linear} from "popmotion"

import VTConstants from '../VoxelTracer/VTConstants';
import VTAmbientLight from "../VoxelTracer/VTAmbientLight";
import VTVoxel from "../VoxelTracer/VTVoxel";
import VTBox from "../VoxelTracer/VTBox";
import VTLambertMaterial from "../VoxelTracer/VTLambertMaterial";
import VTEmissionMaterial from "../VoxelTracer/VTEmissionMaterial";

import VTCTestPattern from '../VoxelTracer/Composites/VTCTestPattern';

import VTPEmitterManager from '../VoxelTracer/Particles/VTPEmitterManager';
import VTPEmitter from '../VoxelTracer/Particles/VTPEmitter';
import VTPRate from '../VoxelTracer/Particles/VTPRate';
import VTPSpan from '../VoxelTracer/Particles/VTPSpan';
import {VTPBoxZone} from '../VoxelTracer/Particles/VTPZones';
import {StaticDirGenerator, VTPBody, VTPLife, VTPPosition, VTPVelocity} from '../VoxelTracer/Particles/VTPInitializers';
import VTPAlpha from '../VoxelTracer/Particles/Behaviours/VTPAlpha';
import VTPColour from '../VoxelTracer/Particles/Behaviours/VTPColour';

import VoxelModel from '../Server/VoxelModel';
import VoxelPostProcessPipeline from '../Server/PostProcess/VoxelPostProcessPipeline';
import VoxelGaussianBlurPP from '../Server/PostProcess/VoxelGaussianBlurPP';
import VoxelChromaticAberrationPP from '../Server/PostProcess/VoxelChromaticAberrationPP';
import VoxelDistortionPP from '../Server/PostProcess/VoxelDistortionPP';
import VoxelTVTurnOffPP from '../Server/PostProcess/VoxelTVTurnOffPP';

import VoxelAnimator from "./VoxelAnimator";
import VoxelConstants from '../VoxelConstants';

const boxSliceSize = 8;
const halfBoxSliceSize = boxSliceSize/2;
const adjBoxSize = boxSliceSize-1;
const boxSize = new THREE.Vector3(adjBoxSize, adjBoxSize, adjBoxSize);

const sliceMoveTimeS = 0.4;
const sliceMoveTimeGapS = 0.075;

const overlapAmount = 2.5;
const centerBoxSize = 2*(overlapAmount-0.5);

const startCubeLum = 0.5;
const endCubeLum = 1.0;
const illumAnimTimeMillis = 600;

const _size = new THREE.Vector3();
const _emitterColour = new THREE.Color(1,1,1);
const _emitterAlpha  = new VTPSpan(1,1);

const quickAnim = false;

export const startupAnimatorDefaultConfig = {
  waitForSlaveConnections: true,
};

class StartupAnimator extends VoxelAnimator {
  constructor(voxelModel, scene) {
    super(voxelModel, {...startupAnimatorDefaultConfig});
    this.scene = scene;
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STARTUP; }
  rendersToCPUOnly() { return true; }

  _buildSceneObjects() {
    const {gridSize} = this.voxelModel;
    this._testPattern = new VTCTestPattern(gridSize);
    this._testPattern.build();

    this._boxSlices = [];
    for (let i = 0; i < 16; i++) {
      const box = new VTBox(
        new THREE.Vector3(), new THREE.Vector3(1, boxSliceSize, boxSliceSize),
        new VTLambertMaterial(new THREE.Color(startCubeLum,startCubeLum,startCubeLum))
      );
      this._boxSlices.push({box, startY:0, endY:0, startAnimTime:0, totalAnimTime:sliceMoveTimeS});
    }

    const boxOptionsNoFill = {samplesPerVoxel: 4, castsShadows: false, receivesShadows: false, fill: false};
    const boxOptionsFill = {...boxOptionsNoFill, fill: true};

    this._boxMin = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(startCubeLum,startCubeLum,startCubeLum)), boxOptionsFill
    );
    this._boxMax = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(startCubeLum,startCubeLum,startCubeLum)), boxOptionsFill
    );

    this._boxMinExpander = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(1,1,1), new THREE.Color(1,1,1), 0), boxOptionsNoFill
    );
    this._boxMaxExpander = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(1,1,1), new THREE.Color(1,1,1), 0), boxOptionsNoFill
    );

    this._boxOutlineMin = new VTBox(new THREE.Vector3(), boxSize.clone().addScalar(1.5), 
      new VTLambertMaterial(new THREE.Color(0,0,0), new THREE.Color(0,0,0), 0), boxOptionsNoFill
    );
    this._boxOutlineMax = new VTBox(new THREE.Vector3(), boxSize.clone().addScalar(1.5), 
      new VTLambertMaterial(new THREE.Color(0,0,0), new THREE.Color(0,0,0), 0), boxOptionsNoFill
    );

    const outlineDrawOrder = VTConstants.DRAW_ORDER_DEFAULT+1;
    this._boxOutlineMin.drawOrder = outlineDrawOrder;
    this._boxOutlineMax.drawOrder = outlineDrawOrder;

    this._boxCenter = new VTBox(new THREE.Vector3(), new THREE.Vector3(centerBoxSize,centerBoxSize,centerBoxSize),
      new VTLambertMaterial(new THREE.Color(0,0,0), new THREE.Color(1,1,1), 0), boxOptionsFill
    );
    this._boxCenter.drawOrder = outlineDrawOrder+1;

    const subSize = 3;
    const boundaryA = gridSize-subSize;
    const spawnRate = new VTPSpan(1, 3);
    const lgSpawnInterval = new VTPSpan(0.1, 0.2);
    const mdSpawnInterval = new VTPSpan(0.175, 0.275);
    const emitterSettings = [
      {min: new THREE.Vector3(0, 0, 0), max: new THREE.Vector3(gridSize, 1, subSize), rate: new VTPRate(spawnRate, lgSpawnInterval)},
      {min: new THREE.Vector3(0, 0, subSize), max: new THREE.Vector3(subSize, 1, boundaryA), rate: new VTPRate(spawnRate, mdSpawnInterval)},
      {min: new THREE.Vector3(0, 0, boundaryA), max: new THREE.Vector3(gridSize, 1, gridSize), rate: new VTPRate(spawnRate, lgSpawnInterval)},
      {min: new THREE.Vector3(boundaryA, 0, subSize), max: new THREE.Vector3(gridSize,  1, boundaryA), rate: new VTPRate(spawnRate, mdSpawnInterval)},
    ];
    const initializers = [
      new VTPBody(VTVoxel, VTEmissionMaterial),
      new VTPLife(0.75, 1.25),
      new VTPVelocity(new VTPSpan(8, 12), new StaticDirGenerator([new THREE.Vector3(0,1,0)])),
    ];
    const behaviours = [
      new VTPAlpha(_emitterAlpha, new VTPSpan(0, 0)),
      new VTPColour(_emitterColour),
    ];

    this._emitterMgr = new VTPEmitterManager(this.scene, 20, [VTVoxel]);
    this._emitters = [];
    for (let i = 0; i < emitterSettings.length; i++) {
      const {min, max, rate} = emitterSettings[i];
      const emitter = new VTPEmitter();
      emitter.rate = rate;
      emitter.addInitializer(new VTPPosition(new VTPBoxZone(min, max)));
      for (const initializer of initializers) { emitter.addInitializer(initializer); }
      for (const behaviour of behaviours) { emitter.addBehaviour(behaviour); }
      this._emitters.push(emitter);
      this._emitterMgr.addEmitter(emitter);
    }

    this._ambientLight = new VTAmbientLight(new THREE.Color(1,1,1));
  }

  _reinit() {
    this.scene.clear();
    this._stopAllAnimations();
    this._stopEmitters();

    for (let i = 0, numSlices = this._boxSlices.length; i < numSlices; i++) {
      this._initBoxSlice(this._boxSlices[i], i);
    }

    this._boxMin.position.set(halfBoxSliceSize, halfBoxSliceSize, halfBoxSliceSize);
    this._boxMin.material.alpha = 1;
    this._boxMin.setSize(boxSize);
    this._boxMax.position.set(boxSliceSize+halfBoxSliceSize, boxSliceSize+halfBoxSliceSize, boxSliceSize+halfBoxSliceSize);
    this._boxMax.material.alpha = 1;
    this._boxMax.setSize(boxSize);

    this._boxMinExpander.position.copy(this._boxMin.position);
    this._boxMinExpander.setSize(boxSize);
    this._boxMinExpander.material.alpha = 0;
    this._boxMaxExpander.position.copy(this._boxMax.position);
    this._boxMaxExpander.material.alpha = 0;
    this._boxMaxExpander.setSize(boxSize);

    this._gaussianBlur.setConfig({kernelSize: 7, sqrSigma: 0, conserveEnergy: false, alpha: 1});
    this._postProcessPipeline.removePostProcess(this._gaussianBlur);
    this._chromaticAberration.setConfig({intensity: 0, alpha:1});
    this._postProcessPipeline.removePostProcess(this._chromaticAberration);
    this._postProcessPipeline.removePostProcess(this._distortion);
    this._postProcessPipeline.removePostProcess(this._tvTurnOff);

    this._currStateFunc = this._testPatternStateFunc.bind(this); // Reinitialize to the start state
    this.isPlaying = false;
  }

  _stopAllAnimations(makeNull=false) {
    // Stop all previous animations
    for (const anim of this._currAnims) { anim.stop(); }
    this._currAnims = makeNull ? null : [];
  }
  _stopEmitters(makeNull=false) {
    for (const emitter of this._emitters) { emitter.stopEmit(); }
    if (makeNull) { this._emitters = null; }
  }

  load() {
    // Setup our post-processing pipeline and kernels
    this._postProcessPipeline = new VoxelPostProcessPipeline(this.voxelModel);
    this._gaussianBlur = new VoxelGaussianBlurPP(this.voxelModel);
    this._chromaticAberration = new VoxelChromaticAberrationPP(this.voxelModel);
    this._distortion = new VoxelDistortionPP(this.voxelModel);
    this._tvTurnOff = new VoxelTVTurnOffPP(this.voxelModel);

    this._currAnims = [];
    this._buildSceneObjects();
    this._reinit();
    this._loadWaitTime = (this.voxelModel.totalCrossfadeTime + 0.5);
  }
  unload() {
    this._postProcessPipeline = null;
    this._gaussianBlur = null;
    this._chromaticAberration = null;
    this._distortion = null;
    this._tvTurnOff = null;

    this._testPattern = null;
    this._boxSlices = null;
    this._emitterMgr = null;
    this._boxMin = null; this._boxMax = null;
    this._boxMinExpander = null; this._boxMaxExpander = null;
    this._boxOutlineMin = null; this._boxOutlineMax = null;
    this._boxCenter = null;

    this._ambientLight = null;

    this._currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations(true);
    this._stopEmitters(true);
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; }
    this._reinit();
  }

  reset() {
    this._reinit();
    this._loadWaitTime = 0.5; // When we hit the reset button change the wait time
  }

  async render(dt) {
    if (!this._isConnected(dt)) {
      if (this.isPlaying) { this.reset(); } // In case we disconnected while playing the animation, reset to the start
      return;
    }

    this._currStateFunc(dt); // Execute the current state
    this._emitterMgr.tick(dt);
    
    await this.scene.render();
    this._postProcessPipeline.render(dt, VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }

  _emptyState(dt) {}

  _testPatternStateFunc(dt) {
    this._currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();
    
    this._testPattern.setAlpha(0);
    this._testPattern.addToScene(this.scene);

    this._distortion.setConfig({noiseAlpha: 0});
    this._postProcessPipeline.addPostProcess(this._distortion);

    this.isPlaying = true;

    const self = this;
    const maxNoiseAlpha = 0.75;
    // Start by animating TV static / _distortion
    this._currAnims.push(animate({
      to: [0, maxNoiseAlpha],
      ease: [linear],
      duration: quickAnim ? 10 : 3000,
      onUpdate: (noiseAlpha) => {
        self._distortion.setConfig({noiseAlpha});
      },
      onComplete: () => {
        // Continue with the _distortion and add the test pattern
        self._currAnims.push(animate({
          to: [[0, maxNoiseAlpha, 1], [1, 0.35, 1], [1, 0, 0.5], [1, 0, 0], [1, 0, 0]],
          offset: [0, 0.2, 0.7, 0.8, 1],
          duration: quickAnim ? 10 : 5000,
          onUpdate: ([tpAlpha, noiseAlpha, distortionAmt]) => {
            self._testPattern.setAlpha(tpAlpha);
            self._distortion.setConfig({noiseAlpha, distortVertical:distortionAmt, distortHorizontal:distortionAmt});
          },
          onComplete: () => {
            self._postProcessPipeline.removePostProcess(self._distortion);
            self._tvTurnOff.setConfig({offAmount:0});
            self._postProcessPipeline.addPostProcess(self._tvTurnOff);
            self._currAnims.push(animate({
              to: [[0,1], [1,1], [1, 0]],
              offset: [0, 0.4, 1],
              duration: quickAnim ? 10 : 1000,
              onUpdate: ([offAmount, tpAlpha]) => {
                self._tvTurnOff.setConfig({offAmount});
                self._testPattern.setAlpha(tpAlpha);
              },
              onComplete: () => {
                self._testPattern.removeFromScene(self.scene);
                self._postProcessPipeline.removePostProcess(self._tvTurnOff);
                self._currStateFunc = self._sliceMoveStateFunc.bind(self);
              }
            }));
          }
        }));
      }
    }));
  }

  _sliceMoveStateFunc(dt) {
    this._currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();

    this.scene.addObject(this._ambientLight);
    for (const slice of this._boxSlices) { 
      this.scene.addObject(slice.box);
    }

    const self = this;
    let numComplete = 0;
    for (const slice of this._boxSlices) {
      const {box, startY, endY, startAnimTime, totalAnimTime} = slice;
      this._currAnims.push(animate({
        to: [startY, endY],
        ease: [anticipate],
        elapsed: -startAnimTime*1000,
        duration: quickAnim ? 10 : totalAnimTime*1000,
        onUpdate: (y) => {
          box.position.set(box.position.x, y, box.position.z);
          box.makeDirty();
        },
        onComplete: () => {
          numComplete++;
          if (numComplete >= this._boxSlices.length) {
            // Move to the next state, replace the slices with two boxes
            for (const slice of this._boxSlices) { self.scene.removeObject(slice.box); }
            self.scene.addObject(self._boxMin);
            self.scene.addObject(self._boxMax);
            self.scene.addObject(self._boxMinExpander);
            self.scene.addObject(self._boxMaxExpander);
            self._currStateFunc = self._boxIllumStateFunc.bind(self);
          }
        }
      }));
    }
  }

  _boxIllumStateFunc(dt) {
    this._currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();

    const self = this;
    const tempSize = new THREE.Vector3();
    this._currAnims.push(animate({
      to: [
        [startCubeLum, 0, adjBoxSize/2], 
        [endCubeLum,   1, adjBoxSize], 
        [endCubeLum,   0, 2*VoxelConstants.VOXEL_GRID_SIZE+1]
      ],
      offset:[0, 0.3, 1],
      duration: quickAnim ? 10 : 3*illumAnimTimeMillis,
      onUpdate: ([lum,alpha,size]) => {

        self._boxMin.material.colour.setRGB(lum, lum, lum);
        self._boxMin.makeDirty();
        self._boxMax.material.colour.setRGB(lum, lum, lum);
        self._boxMax.makeDirty();

        self._boxMinExpander.material.alpha = alpha;
        self._boxMaxExpander.material.alpha = alpha;
        tempSize.set(size,size,size);
        self._boxMinExpander.setSize(tempSize);
        self._boxMaxExpander.setSize(tempSize);
      },
      onComplete: () => {
        self.scene.removeObject(self._boxMinExpander);
        self.scene.removeObject(self._boxMaxExpander);
        self._currStateFunc = self._boxMoveToOverlapStateFunc.bind(self);
      }
    }));
  }

  _boxMoveToOverlapStateFunc(dt) {
    this._currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();

    const self = this;
    const boxMinStartPos = this._boxMin.position.clone();
    const boxMaxStartPos = this._boxMax.position.clone();

    const pullbackAmount = -0.5*overlapAmount
    this._currAnims.push(animate({
      to: [0, pullbackAmount, pullbackAmount, overlapAmount],
      offset: [0, 0.4, 0.45, 1],
      ease: [bounceInOut, linear, anticipate], //linear, easeIn, easeOut, bounceIn, bounceOut, bounceInOut
      duration: quickAnim ? 10 : 800,
      onUpdate: (amt) => {
        self._boxMin.position.copy(boxMinStartPos).addScalar(amt);
        self._boxMin.makeDirty();
        self._boxMax.position.copy(boxMaxStartPos).subScalar(amt);
        self._boxMax.makeDirty();
      },
      onComplete: () => {
        self._currStateFunc = self._boxJoinedStateFunc.bind(self);
      }
    }));
  }

  _boxJoinedStateFunc(dt) {
    this._currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();
    this._stopEmitters();

    const halfUnits = VoxelConstants.VOXEL_HALF_GRID_SIZE;
    this._boxCenter.material.alpha = 0;
    this._boxCenter.position.set(halfUnits, halfUnits, halfUnits);
    this._boxCenter.makeDirty();

    this._boxOutlineMin.material.alpha = 0;
    this._boxOutlineMin.position.copy(this._boxMin.position);
    this._boxOutlineMin.makeDirty();
    this._boxOutlineMax.material.alpha = 0;
    this._boxOutlineMax.position.copy(this._boxMax.position);
    this._boxOutlineMax.makeDirty();
    
    this.scene.addObject(this._boxOutlineMin);
    this.scene.addObject(this._boxOutlineMax);
    this.scene.addObject(this._boxCenter);

    this._postProcessPipeline.addPostProcess(this._gaussianBlur);
    _emitterColour.setRGB(1,1,1);

    const self = this;
    const flashBlurSqSigma = 1.7;
    let emitStarted = false;

    this._currAnims.push(animate({
      to: [[0, 1, 0, 0], [1, 0.5, 0, flashBlurSqSigma], [1, 0.5, 0, 0], [1, 0.5, 1, 0]],
      offset: [0, 0.3, 0.6, 1.0],
      ease: [easeInOut, linear, linear],
      duration: 3000,
      onUpdate: ([outlineAlpha, boxAlpha, emitterAlpha, sqrSigma]) => {
        self._boxOutlineMin.material.alpha = outlineAlpha;
        self._boxOutlineMin.makeDirty();
        self._boxOutlineMax.material.alpha = outlineAlpha;
        self._boxOutlineMax.makeDirty();

        self._boxCenter.material.alpha = outlineAlpha;
        self._boxCenter.makeDirty();

        self._boxMin.material.alpha = boxAlpha;
        self._boxMin.makeDirty();
        self._boxMax.material.alpha = boxAlpha;
        self._boxMax.makeDirty();

        self._gaussianBlur.setConfig({sqrSigma, conserveEnergy: false});
        if (!emitStarted && sqrSigma === 0) {
          for (const emitter of this._emitters) { emitter.startEmit(Infinity); }
          emitStarted = true;
        }
        _emitterAlpha.a = _emitterAlpha.b = emitterAlpha;
      },
      onComplete: () => {
        const colours = ["#fff", "#f00", "#0f0", "#00f", "#fff"];
        const colourBlurSqrSigma = 0.25;
        self._currAnims.push(animate({
          to: [
            [0,0], [1,colourBlurSqrSigma], 
            [1,0], [2,colourBlurSqrSigma], 
            [2,0], [3,colourBlurSqrSigma],
            [3,0], [4,colourBlurSqrSigma],
            [4,0]
          ],
          duration: 6000,
          onUpdate: ([progressIdx, sqrSigma]) => {
            const idx = Math.round(progressIdx);
            const colour = colours[idx];
            _emitterColour.set(colour);

            self._boxCenter.material.emissive.set(colour);
            self._boxCenter.makeDirty();
            self._gaussianBlur.setConfig({sqrSigma, conserveEnergy: true});
          },
          onComplete: () => {
            self._currStateFunc = this._endStateFunc.bind(self);
          }
        }));
      }
    }));    
  }

  _endStateFunc(dt) {
    this._currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();
    this._postProcessPipeline.removePostProcess(this._gaussianBlur);
    this._chromaticAberration.setConfig({xyzMask:[1,1,1]});
    this._postProcessPipeline.addPostProcess(this._chromaticAberration);

    const self = this;

    this._currAnims.push(animate({
      to: [[0,1], [VoxelConstants.VOXEL_HALF_GRID_SIZE+1,0]],
      offset: [0, 1],
      ease: [linear],
      duration: 1500,
      onUpdate: ([intensity, alpha]) => {
        self._chromaticAberration.setConfig({intensity, alpha});
      },
      onComplete: () => {
        // Glitch the omnivox logo with _distortion jitters and chromatic aberration every once in a while
        self._chromaticAberration.setConfig({intensity:0, alpha:1});
        self._distortion.setConfig({noiseAlpha: 0, noiseSpeed: 1, distortHorizontal:1, distortVertical: 1, xyzMask:[0,1,0]});
        this._postProcessPipeline.addPostProcess(self._distortion);

        self._currAnims.push(animate({
          to:     [[0,0,0], [1,0,0], [0,1,1], [-1,2,1], [0,0,0], [1,1,1], [0,0,0], [0,0,0], [1,1,1], [-1,2,1], [0,1,1], [-1,0,0], [1,0,0], [0,0,0]],
          offset: [0,       0.10,    0.20,    0.25,     0.30,    0.38,    0.43,    0.70,    0.72,    0.78,     0.85,    0.92,     0.95,    1],
          duration: 10000,
          elapsed: -2000,
          repeat: Infinity,
          onUpdate: ([intensity, distortHorizontal, distortVertical]) => {
            self._chromaticAberration.setConfig({intensity: Math.round(intensity)});
            const absIntensity = Math.abs(intensity);
            self._distortion.setConfig({
              noiseAlpha: (absIntensity > 0.1 && distortHorizontal > 0 && distortVertical > 0) ? 0.3 : 0, 
              distortHorizontal,
              distortVertical
            });
          },
        }));
      }
    }));
  }

  _initBoxSlice(target, idx) {
    const isMin = idx < 8;
    const x = isMin ? idx : idx+1;
    const startY = isMin ? boxSliceSize*2+halfBoxSliceSize+1 : -(halfBoxSliceSize+1);
    const endY = isMin ? halfBoxSliceSize-0.5 : 16-(halfBoxSliceSize-0.5);
    const zPosition = halfBoxSliceSize + (isMin ? -0.5 : 8.5);

    const {box} = target;
    box.position.set(x, startY, zPosition);
    _size.set(1, boxSliceSize, boxSliceSize);
    box.setSize(_size);

    target.startY = startY;
    target.endY = endY;
    target.startAnimTime = sliceMoveTimeGapS*idx;
  }

  _isConnected(dt) {
    const {voxelServer} = this.voxelModel;
    const {waitForSlaveConnections} = this.config;
    this._loadWaitTime -= dt;
    return this._loadWaitTime <= 0 && 
      (voxelServer && voxelServer.viewerWebSocks.length > 0) && 
      (!waitForSlaveConnections || voxelServer.areSlavesConnected());
  }

}

export default StartupAnimator;