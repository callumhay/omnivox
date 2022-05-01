import * as THREE from 'three';
import {animate, anticipate, bounceInOut, easeIn, easeInOut, linear} from "popmotion"

import VTConstants from '../VoxelTracer/VTConstants';
import VTAmbientLight from "../VoxelTracer/VTAmbientLight";
import VTBox from "../VoxelTracer/VTBox";
import VTLambertMaterial from "../VoxelTracer/VTLambertMaterial";

import VTCTestPattern from '../VoxelTracer/Composites/VTCTestPattern';

import VoxelModel from '../Server/VoxelModel';
import VoxelPostProcessPipeline from '../Server/PostProcess/VoxelPostProcessPipeline';
import VoxelGaussianBlurPP from '../Server/PostProcess/VoxelGaussianBlurPP';
import VoxelChromaticAberrationPP from '../Server/PostProcess/VoxelChromaticAberrationPP';
import VoxelDistortionPP from '../Server/PostProcess/VoxelDistortionPP';
import VoxelTVTurnOffPP from '../Server/PostProcess/VoxelTVTurnOffPP';

import VoxelAnimator from "./VoxelAnimator";
import VoxelConstants from '../VoxelConstants';
import {Randomizer} from '../Randomizers';

const boxSliceSize = 8;
const halfBoxSliceSize = boxSliceSize/2;
const adjBoxSize = boxSliceSize-1;
const boxSize = new THREE.Vector3(adjBoxSize, adjBoxSize, adjBoxSize);

const sliceMoveTimeS = 0.4;
const sliceMoveTimeGapS = 0.075;

const overlapAmount = 2.5;
const centerBoxSize = 2*(overlapAmount-0.5);
const boxOptions = {samplesPerVoxel: 4, castsShadows: false, receivesShadows: false};

const UPDATE_DELTA_UNITS = 0.1;

const startCubeLum = 0.5;
const endCubeLum = 1.0;
const illumAnimTimeMillis = 600;

const _size = new THREE.Vector3();

export const startupAnimatorDefaultConfig = {
  waitForSlaveConnections: true,
};

class StartupAnimator extends VoxelAnimator {
  constructor(voxelModel, scene) {
    super(voxelModel, {...startupAnimatorDefaultConfig});
    this.scene = scene;

    this.currAnims = [];
    
    // Setup our post-processing pipeline and kernels
    this.postProcessPipeline = new VoxelPostProcessPipeline(voxelModel);
    this.gaussianBlur = new VoxelGaussianBlurPP(voxelModel);
    this.chromaticAberration = new VoxelChromaticAberrationPP(voxelModel);
    this.distortion = new VoxelDistortionPP(voxelModel);
    this.tvTurnOff = new VoxelTVTurnOffPP(voxelModel);
    
    // NOTE: The startup routine is always loaded into memory by default, this helps avoid lag in creating the objects
    this._buildSceneObjects();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STARTUP; }
  rendersToCPUOnly() { return true; }

  _buildSceneObjects() {
    this.testPattern = new VTCTestPattern(this.voxelModel.gridSize);
    this.testPattern.build();

    this._boxSlices = [];
    for (let i = 0; i < 16; i++) {
      const box = new VTBox(
        new THREE.Vector3(), new THREE.Vector3(1, boxSliceSize, boxSliceSize),
        new VTLambertMaterial(new THREE.Color(startCubeLum,startCubeLum,startCubeLum))
      );
      this._boxSlices.push({box, startY:0, endY:0, startAnimTime:0, totalAnimTime:sliceMoveTimeS});
    }

    this._boxMin = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(startCubeLum,startCubeLum,startCubeLum)), {...boxOptions, fill: true}
    );
    this._boxMax = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(startCubeLum,startCubeLum,startCubeLum)), {...boxOptions, fill: true}
    );

    this._boxMinExpander = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(1,1,1), new THREE.Color(1,1,1), 0), {...boxOptions, fill: false}
    );
    this._boxMaxExpander = new VTBox(new THREE.Vector3(), boxSize.clone(),
      new VTLambertMaterial(new THREE.Color(1,1,1), new THREE.Color(1,1,1), 0), {...boxOptions, fill: false}
    );

    this._boxOutlineMin = new VTBox(new THREE.Vector3(), boxSize.clone().addScalar(1.5), 
      new VTLambertMaterial(new THREE.Color(0,0,0), new THREE.Color(0,0,0), 0), {...boxOptions, fill:false}
    );
    this._boxOutlineMax = new VTBox(new THREE.Vector3(), boxSize.clone().addScalar(1.5), 
      new VTLambertMaterial(new THREE.Color(0,0,0), new THREE.Color(0,0,0), 0), {...boxOptions, fill:false}
    );

    const outlineDrawOrder = VTConstants.DRAW_ORDER_DEFAULT+1;
    this._boxOutlineMin.drawOrder = outlineDrawOrder;
    this._boxOutlineMax.drawOrder = outlineDrawOrder;

    this._boxCenter = new VTBox(new THREE.Vector3(), new THREE.Vector3(centerBoxSize,centerBoxSize,centerBoxSize),
      new VTLambertMaterial(new THREE.Color(0,0,0), new THREE.Color(1,1,1), 0), {...boxOptions, fill: true}
    );
    this._boxCenter.drawOrder = outlineDrawOrder+1;

    this._ambientLight = new VTAmbientLight(new THREE.Color(1,1,1));
  }

  _reinitSceneObjects() {
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

    this.gaussianBlur.setConfig({kernelSize: 7, sqrSigma: 0, conserveEnergy: false, alpha: 1});
    this.postProcessPipeline.removePostProcess(this.gaussianBlur);
    this.chromaticAberration.setConfig({intensity: 0, alpha:1});
    this.postProcessPipeline.removePostProcess(this.chromaticAberration);
    this.postProcessPipeline.removePostProcess(this.distortion);
    this.postProcessPipeline.removePostProcess(this.tvTurnOff);
  }

  _stopAllAnimations() {
    // Stop all previous animations
    for (const anim of this.currAnims) {
      anim.stop();
    }
    this.currAnims = [];
  }

  load() {
    // All objects are already loaded, we just need to set the scene and
    // initialize any animation state-related variables
    this.scene.clear();
    this._stopAllAnimations();
    this._reinitSceneObjects();

    this.currStateFunc = this._testPatternStateFunc.bind(this); // Reinitialize to the start state

    this._loadWaitTime = (this.voxelModel.totalCrossfadeTime + 0.5);
    this.isPlaying = false;
  }
  unload() {
    this.currStateFunc = this._emptyState.bind(this);
    this.isPlaying = false;
    this._stopAllAnimations();
  }


  setConfig(c) {
    super.setConfig(c);
  }

  reset() {
    super.reset();
    this.load();
    this._loadWaitTime = 0.5; // When we hit the reset button change the wait time
  }

  async render(dt) {
    if (!this._isConnected(dt)) {
      if (this.isPlaying) { this.reset(); } // In case we disconnected while playing the animation, reset to the start
      return;
    }
    //const dtSafe = Math.min(dt, 1.0/30.0);
    this.currStateFunc(dt); // Execute the current state
    await this.scene.render();
    this.postProcessPipeline.render(dt, VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }

  _emptyState(dt) {}

  _testPatternStateFunc(dt) {
    this.currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();
    
    this.testPattern.setAlpha(0);
    this.testPattern.addToScene(this.scene);

    this.distortion.setConfig({noiseAlpha: 0});
    this.postProcessPipeline.addPostProcess(this.distortion);

    this.isPlaying = true;

    const self = this;
    const maxNoiseAlpha = 0.75;
    // Start by animating TV static / distortion
    this.currAnims.push(animate({
      to: [0, maxNoiseAlpha],
      ease: [linear],
      duration: 3000,
      onUpdate: (noiseAlpha) => {
        self.distortion.setConfig({noiseAlpha});
      },
      onComplete: () => {
        // Continue with the distortion and add the test pattern
        self.currAnims.push(animate({
          to: [[0, maxNoiseAlpha, 1], [1, 0.35, 1], [1, 0, 0.5], [1, 0, 0]],
          offset: [0, 0.2, 0.75, 1],
          duration: 5000,
          onUpdate: ([tpAlpha, noiseAlpha, distortionAmt]) => {
            self.testPattern.setAlpha(tpAlpha);
            self.distortion.setConfig({noiseAlpha, distortVertical:distortionAmt, distortHorizontal:distortionAmt});
          },
          onComplete: () => {
            self.postProcessPipeline.removePostProcess(self.distortion);
            self.tvTurnOff.setConfig({offAmount:0});
            self.postProcessPipeline.addPostProcess(self.tvTurnOff);
            self.currAnims.push(animate({
              to: [[0,1], [1,1], [1, 0]],
              offset: [0, 0.4, 1],
              duration: 1000,
              onUpdate: ([offAmount, tpAlpha]) => {
                self.tvTurnOff.setConfig({offAmount});
                self.testPattern.setAlpha(tpAlpha);
              },
              onComplete: () => {
                self.testPattern.removeFromScene(self.scene);
                self.postProcessPipeline.removePostProcess(self.tvTurnOff);
              }
            }));
          }
        }));
      }
    }));

  }

  _sliceMoveStateFunc(dt) {
    this.currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();

    this.scene.addObject(this._ambientLight);
    for (const slice of this._boxSlices) { 
      this.scene.addObject(slice.box);
    }

    const self = this;
    let numComplete = 0;
    for (const slice of this._boxSlices) {
      const {box, startY, endY, startAnimTime, totalAnimTime} = slice;
      this.currAnims.push(animate({
        to: [startY, endY],
        ease: [anticipate],
        elapsed: -startAnimTime*1000,
        duration: totalAnimTime*1000,
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
            self.currStateFunc = self._boxIllumStateFunc.bind(self);
          }
        }
      }));
    }
  }

  _boxIllumStateFunc(dt) {
    this.currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();

    const self = this;
    const tempSize = new THREE.Vector3();
    this.currAnims.push(animate({
      to: [
        [startCubeLum, 0, adjBoxSize/2], 
        [endCubeLum,   1, adjBoxSize], 
        [endCubeLum,   0, 2*VoxelConstants.VOXEL_GRID_SIZE+1]
      ],
      offset:[0, 0.3, 1],
      duration:3*illumAnimTimeMillis,
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
        self.currStateFunc = self._boxMoveToOverlapStateFunc.bind(self);
      }
    }));
  }

  _boxMoveToOverlapStateFunc(dt) {
    this.currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();

    const self = this;
    let prevAmt = 0;
    const boxMinStartPos = this._boxMin.position.clone();
    const boxMaxStartPos = this._boxMax.position.clone();

    const pullbackAmount = -0.5*overlapAmount
    this.currAnims.push(animate({
      to: [0, pullbackAmount, pullbackAmount, overlapAmount],
      offset: [0, 0.4, 0.45, 1],
      ease: [bounceInOut, linear, anticipate], //linear, easeIn, easeOut, bounceIn, bounceOut, bounceInOut
      duration: 800,
      onUpdate: (amt) => {
        if (Math.abs(prevAmt-amt) > UPDATE_DELTA_UNITS) {
          self._boxMin.position.copy(boxMinStartPos).addScalar(amt);
          self._boxMin.makeDirty();
          self._boxMax.position.copy(boxMaxStartPos).subScalar(amt);
          self._boxMax.makeDirty();
        }
        prevAmt = amt;
      },
      onComplete: () => {
        self.currStateFunc = self._boxJoinedStateFunc.bind(self);
      }
    }));
  }

  _boxJoinedStateFunc(dt) {
    this.currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();

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

    this.postProcessPipeline.addPostProcess(this.gaussianBlur);
    
    const self = this;
    const flashBlurSqSigma = 1.8;
    this.currAnims.push(animate({
      to: [[0, 1, 0], [1, 0.5, flashBlurSqSigma], [1, 0.5, 0]],
      ease: [easeInOut, linear],
      duration: 2000,
      onUpdate: ([outlineAlpha, boxAlpha, sqrSigma]) => {
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

        self.gaussianBlur.setConfig({sqrSigma, conserveEnergy: false});
      },
      onComplete: () => {
        const colours = ["#fff", "#f00", "#0f0", "#00f", "#fff"];
        const colourBlurSqrSigma = 1;
        self.currAnims.push(animate({
          to: [
            [0,0], [1,colourBlurSqrSigma], 
            [1,0], [2,colourBlurSqrSigma], 
            [2,0], [3,colourBlurSqrSigma],
            [3,0], [4,colourBlurSqrSigma],
            [4,0]
          ],
          duration: 4000,
          onUpdate: ([progressIdx, sqrSigma]) => {
            const idx = Math.round(progressIdx);
            self._boxCenter.material.emissive.set(colours[idx]);
            self._boxCenter.makeDirty();
            self.gaussianBlur.setConfig({sqrSigma, conserveEnergy: true});
          },
          onComplete: () => {
            self.currStateFunc = this._endStateFunc.bind(self);
          }
        }));
      }
    }));    
  }

  _endStateFunc(dt) {
    this.currStateFunc = this._emptyState.bind(this);
    this._stopAllAnimations();
    this.postProcessPipeline.removePostProcess(this.gaussianBlur);
    this.postProcessPipeline.addPostProcess(this.chromaticAberration);

    const self = this;

    this.currAnims.push(animate({
      to: [[0,1], [VoxelConstants.VOXEL_HALF_GRID_SIZE+1,0]],
      offset: [0, 1],
      ease: [linear],
      duration: 1500,
      //repeat: Infinity,
      onUpdate: ([intensity, alpha]) => {
        self.chromaticAberration.setConfig({intensity, alpha});
      },
      onComplete: () => {
        //self._stopAllAnimations();
      }
    }));

    /*
    // Jitter the chromatic aberration
    let prevValue = -1;
    this._jitterAnim = animate({
      to:     [0, 0,    1,    1,    2,    2,    3,    3,    4,    4],
      offset: [0, 0.14, 0.15, 0.49, 0.50, 0.69, 0.70, 0.89, 0.90, 1],
      duration: 1000,
      repeat: Infinity,
      onUpdate: (value) => {
        const roundedValue = Math.round(value);
        let xyzMask = [1,1,1];
        let intensity = 0;
        if (prevValue !== roundedValue) {
          switch (roundedValue) {
            case 0:
            case 2:
            case 3:
            default:
              break;
            case 1:
            case 4:
              intensity = Randomizer.getRandomIntInclusive(0,1) * Randomizer.getRandomIntInclusive(-1,1);
              xyzMask = [
                Randomizer.getRandomIntInclusive(-1,1), 
                Randomizer.getRandomIntInclusive(-1,1), 
                Randomizer.getRandomIntInclusive(-1,1)
              ];
              break;
          }
          self.chromaticAberration.setConfig({intensity, xyzMask});
          prevValue = roundedValue;
        }
      }
    });
    */
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
      (voxelServer && voxelServer.viewerWS) && 
      (!waitForSlaveConnections || voxelServer.areSlavesConnected());
  }

}

export default StartupAnimator;