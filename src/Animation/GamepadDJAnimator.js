import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import chroma from 'chroma-js';

import VoxelModel from '../Server/VoxelModel';
import VoxelGaussianBlurPP from '../Server/PostProcess/VoxelGaussianBlurPP';
import VoxelChromaticAberrationPP from '../Server/PostProcess/VoxelChromaticAberrationPP';
import VoxelPostProcessPipeline from '../Server/PostProcess/VoxelPostProcessPipeline';

import VTPAlpha from '../VoxelTracer/Particles/Behaviours/VTPAlpha';
import VTPColour from '../VoxelTracer/Particles/Behaviours/VTPColour';
import {VTPBody, VTPLife, VTPVelocity, SpiralDirGenerator} from '../VoxelTracer/Particles/VTPInitializers';
import VTPEmitterManager from '../VoxelTracer/Particles/VTPEmitterManager';
import VTPEmitter from '../VoxelTracer/Particles/VTPEmitter';
import VTPRate from '../VoxelTracer/Particles/VTPRate';
import VTPSpan from '../VoxelTracer/Particles/VTPSpan';

import VTPointLight from '../VoxelTracer/VTPointLight';
import VTDirectionalLight from '../VoxelTracer/VTDirectionalLight';
import VTAmbientLight from '../VoxelTracer/VTAmbientLight';
import VTEmissionMaterial from '../VoxelTracer/VTEmissionMaterial';
import VTLambertMaterial from '../VoxelTracer/VTLambertMaterial';
import {VTFogBox} from '../VoxelTracer/VTFog';
import VTSphere, {defaultSphereOptions} from '../VoxelTracer/VTSphere';
import VTVoxel from '../VoxelTracer/VTVoxel';

import VoxelConstants from '../VoxelConstants';
import PhysicsUtils from '../PhysicsUtils';
import {SCRIABIN_NOTE_COLOURS} from '../Spectrum';
import {Randomizer} from '../Randomizers';
import {calcSphereMass} from '../MathUtils';

import VoxelAnimator from './VoxelAnimator';
import AudioVisualizerAnimator from './AudioVisualizerAnimator';

export const gamepadDJAnimatorDefaultConfig = {
  rmsLevelMax: 0.25,
  noteColourPalette: [...SCRIABIN_NOTE_COLOURS],
  sphereBurstThresholdMultiplier: 1,
  cursorMinAtten: 0.8,
  cursorMaxAtten: 1.7,
};

const WALL_COLLISION_GRP   = 1;
const SPHERE_COLLISION_GRP = 2;
const LIGHT_COLLISION_GRP  = 4;

const CURSOR_MAX_SPEED = VoxelConstants.VOXEL_GRID_SIZE;

const MIN_TIME_BETWEEN_SPHERE_PULSES = 2.0;
const BASE_GRAVITY = 0;
const MAX_BOUNCE_LIGHTS = 3;
const MAX_BOUNCE_SPHERES = 6;

const _tempVec3 = new THREE.Vector3();
const _newPulseColour = new THREE.Color();
const _tempColour = new THREE.Color();
const _boundingSphere = new THREE.Sphere();

class GamepadDJAnimator extends AudioVisualizerAnimator {
  constructor(voxelModel, scene, config=gamepadDJAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.scene = scene;
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_GAMEPAD_DJ; }
  rendersToCPUOnly() { return true; }

  _reinit() {
    this.bounceSpheres = [];
    this.bounceLights  = [];

    const halfGridSizeIdx = VoxelConstants.VOXEL_HALF_GRID_SIZE-1;
    this.cursorPtLight.position.set(halfGridSizeIdx,halfGridSizeIdx,halfGridSizeIdx);

    this.lastPhysicsWorldStepTime = 0;
    this.timeCounter = 0;
    this.prevBassTotal = 0;
    this.prevBaseDerivative = 0;
    this.currSpherePulseIdx = 0;
    this.timeSinceLastSpherePulse = MIN_TIME_BETWEEN_SPHERE_PULSES+1;

    this.gaussianBlur.setConfig({kernelSize: 3, sqrSigma: 0, conserveEnergy: false});
    this.chromaticAbr.setConfig({intensity: 0, alpha: 1});

    this.emitter.stopEmit();
    this.emitterOn = false;

    this._resetControllerState();

    this.scene.clear();
    for (const sp of this.spherePulses) { this.scene.addObject(sp.sphere); }
    this.scene.addObject(this.cursorPtLight);
    this.scene.addObject(this.dirLight1);
    this.scene.addObject(this.dirLight2);
    this.scene.addObject(this.fog);
    this.scene.addObject(this.ambientLight);
  }
  _resetControllerState() {
    this.currAxisState = {
      leftStick:  {x: 0, y: 0},
      rightStick: {x: 0, y: 0}
    };
    this.currButtonState = {
      north: 0, south: 0, west: 0, east: 0,
      leftBumper: 0, rightBumper: 0,
      leftTrigger: 0, rightTrigger: 0,
      select: 0, start: 0,
      leftAnalog: 0, rightAnalog: 0,
      dPadUp: 0, dPadDown: 0, dPadLeft: 0, dPadRight: 0,
      special: 0
    };
  }

  load() {
    super.load();

    const maxValue = this.voxelModel.gridSize + VoxelConstants.VOXEL_EPSILON;
    const minValue = -VoxelConstants.VOXEL_EPSILON;
    this.minBoundsPt = new THREE.Vector3(minValue, minValue, minValue);
    this.maxBoundsPt = new THREE.Vector3(maxValue, maxValue, maxValue);

    this.gaussianBlur = new VoxelGaussianBlurPP(this.voxelModel);
    this.chromaticAbr = new VoxelChromaticAberrationPP(this.voxelModel);
    this.postProcessPipeline = new VoxelPostProcessPipeline(this.voxelModel);
    this.postProcessPipeline.addPostProcess(this.gaussianBlur);
    this.postProcessPipeline.addPostProcess(this.chromaticAbr);

    // Setup the physics world
    this.world = new CANNON.World();
    this.world.gravity.set(0,BASE_GRAVITY,0);
    this.wallMaterial    = new CANNON.Material('wall_mat');
    this.sphereMaterial  = new CANNON.Material('sphere_mat');
    this.lightMaterial   = new CANNON.Material('light_mat');

    const lightWallCM    = new CANNON.ContactMaterial(this.lightMaterial, this.wallMaterial, {friction: 0, restitution: 1});
    const sphereWallCM   = new CANNON.ContactMaterial(this.wallMaterial, this.sphereMaterial, {friction: 0.1, restitution: 1});
    const sphereSphereCM = new CANNON.ContactMaterial(this.sphereMaterial, this.sphereMaterial, {friction: 0.25, restitution: 0.5});
    this.world.addContactMaterial(lightWallCM);
    this.world.addContactMaterial(sphereWallCM);
    this.world.addContactMaterial(sphereSphereCM);

    // Create walls (collision planes) along the edges of the voxel box
    const wallBodies = PhysicsUtils.buildSideWalls(this.voxelModel.gridSize, this.wallMaterial);
    for (const wallBody of wallBodies) { 
      wallBody.collisionFilterGroup = WALL_COLLISION_GRP;
      this.world.addBody(wallBody);
    }

    // Voxel tracer lights and fog
    const {gridSize} = this.voxelModel;
    this.cursorPtLight = new VTPointLight(new THREE.Vector3(), new THREE.Color(1,1,1), {quadratic:2, linear:0}, true);
    this.dirLight1 = new VTDirectionalLight(new THREE.Vector3(1, -1, 1), new THREE.Color(0,0,0));
    this.dirLight2 = new VTDirectionalLight(new THREE.Vector3(-0.75, -0.2, -0.5), new THREE.Color(0,0,0));
    this.ambientLight = new VTAmbientLight(new THREE.Color(0.25, 0.25, 0.25));
    this.fog = new VTFogBox(new THREE.Vector3(0,0,0), new THREE.Vector3(gridSize, gridSize, gridSize), new THREE.Color(1,1,1), 1);
    this.fog.drawOrder = 5;

    // Expanding sphere pulses
    const SPHERE_PULSE_BUFFER_SIZE = 8;
    this.spherePulses = Array(SPHERE_PULSE_BUFFER_SIZE).fill(null);
    for (let i = 0; i < SPHERE_PULSE_BUFFER_SIZE; i++) {
      const pulse = {
        active: false,
        growSpeed: gridSize*0.5,
        alphaFadeSpeed: 0.4,
        sphere: new VTSphere(
          new THREE.Vector3(gridSize,gridSize,gridSize), 0, 
          new VTEmissionMaterial(new THREE.Color(1,1,1), 0), 
          {...defaultSphereOptions, castsShadows: false, receivesShadows: false, samplesPerVoxel:1}
        )
      };
      this.spherePulses[i] = pulse;
    }

    // Particle emitter
    this.emitter = new VTPEmitter();
    this.emitter.rate = new VTPRate(new VTPSpan(3,5), new VTPSpan(0.03));
    this.emitter.addInitializer(new VTPBody(VTVoxel, VTLambertMaterial, {receivesShadows: false, castsShadows: false}));
    this.emitter.addInitializer(new VTPLife(0.75, 1.25));
    this.emitterVelInit = new VTPVelocity(new VTPSpan(14,18), new SpiralDirGenerator(Math.PI/8, Math.PI/8, Math.PI/180, Math.PI/180));
    this.emitter.addInitializer(this.emitterVelInit);
    this.emitter.addBehaviour(new VTPAlpha(1,0));
    this.emitterColourBehaviour = new VTPColour([0xffffff]);
    this.emitter.addBehaviour(this.emitterColourBehaviour);
    this.emitterMgr = new VTPEmitterManager(this.scene, 64, [VTVoxel]);
    this.emitterMgr.addEmitter(this.emitter);

    this._reinit();
  }
  unload() {
    super.unload();
    this.minBoundsPt = null; this.maxBoundsPt = null;
    this.postProcessPipeline = null; this.gaussianBlur = null; this.chromaticAbr = null;
    this.world = null;
    this.wallMaterial = null; this.sphereMaterial = null; this.lightMaterial = null;
    this.bounceSpheres = null; this.bounceLights = null;
    this.cursorPtLight = null; this.dirLight1 = null; this.dirLight2 = null; this.ambientLight = null;
    this.fog = null;
    this.spherePulses = null;
    this.emitter = null; this.emitterMgr = null;
    this.emitterVelInit = null;
    this.emitterColourBehaviour = null;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; }
    this._reinit();
  }

  reset() {
    super.reset();
    this._reinit();
  }

  async render(dt) {
    // Simulate the physics
    this.lastPhysicsWorldStepTime = PhysicsUtils.stepWorld(this.world, this.lastPhysicsWorldStepTime, dt);

    // Physics to renderer updates
    for (const bounceSphere of this.bounceSpheres) {
      const {vtSphere, sphereBody} = bounceSphere;

      bounceSphere.currLifeTimeInSecs += dt;
      if (bounceSphere.currLifeTimeInSecs > bounceSphere.totalLifeTimeInSecs) {
        // Remove from the physics world and rendering scene
        this.world.removeBody(sphereBody);
        this.scene.removeObject(vtSphere);
        continue;
      }
      
      const {position:spherePos} = sphereBody;
      vtSphere.position.copy(spherePos);
      vtSphere.material.alpha = 1.0-THREE.MathUtils.smoothstep(bounceSphere.currLifeTimeInSecs, 0, bounceSphere.totalLifeTimeInSecs);
      vtSphere.setMaterial(vtSphere.material);
    }
    this.bounceSpheres = this.bounceSpheres.filter(bs => bs.currLifeTimeInSecs <= bs.totalLifeTimeInSecs); // Clean up the expired bounce spheres

    for (const bounceLight of this.bounceLights) {
      const {ptLight, lightBody} = bounceLight;

      bounceLight.currLifeTimeInSecs += dt;
      if (bounceLight.currLifeTimeInSecs > bounceLight.totalLifeTimeInSecs) {
        // Remove from the physics world and rendering scene
        this.world.removeBody(lightBody);
        this.scene.removeObject(ptLight);
        continue;
      }

      const {position:spherePos} = lightBody;
      ptLight.position.set(spherePos.x, spherePos.y, spherePos.z);
      ptLight.setPosition(ptLight.position);
    }
    this.bounceLights = this.bounceLights.filter(bl =>  bl.currLifeTimeInSecs <= bl.totalLifeTimeInSecs); // Clean up the expired bounce lights

    // Update the position of the cursor:
    // Left analog stick  – Moves the cursor: Up/down is the y-axis
    // Right analog stick – Moves the cursor: Up/down is the z-axis, left/right is the x-axis
    const {leftStick,rightStick} = this.currAxisState;

    _tempVec3.set(rightStick.x, leftStick.y, rightStick.y);
    _tempVec3.multiplyScalar(CURSOR_MAX_SPEED*dt);
    this.cursorPtLight.position.add(_tempVec3).clampScalar(0, VoxelConstants.VOXEL_GRID_SIZE-1);
    this.cursorPtLight.makeDirty();

    // Sphere Pulse Updates: When the music gets really intense suddenly we trigger a bright sphere pulse that eminates from the cursor
    const {gridSize} = this.voxelModel;
    const rmsEffect = this.avgRMSPercent();
    for (const pulse of this.spherePulses) {
      const {active, growSpeed, alphaFadeSpeed, sphere, currAlpha} = pulse;
      if (!active) { continue; }
      
      // If the sphere is invisible or is so large that it encompasses the voxel grid, then we deactive it.
      sphere.getBoundingSphere(_boundingSphere);
      if (currAlpha <= 0 || _boundingSphere.containsPoint(this.minBoundsPt) && _boundingSphere.containsPoint(this.maxBoundsPt)) {
        sphere.material.alpha = 0;
        sphere.position.copy(new THREE.Vector3(gridSize,gridSize,gridSize));
        sphere.setMaterial(sphere.material);
        sphere.setRadius(0);
        pulse.active = false;
        pulse.currAlpha = 0;
        pulse.currRadius = 0;
      }
      else {
        // Update the sphere dimensions and material to animate its pulse
        pulse.currRadius += dt*growSpeed*Math.max(1, 0.5+rmsEffect);
        pulse.currAlpha  -= dt*alphaFadeSpeed;

        if (Math.abs(sphere.radius-pulse.currRadius) > VoxelConstants.VOXEL_ERR_UNITS) {
          sphere.setRadius(pulse.currRadius);
          sphere.material.alpha = pulse.currAlpha;
          sphere.material.setColour(this.cursorPtLight.colour);
          sphere.setMaterial(sphere.material);
        }
      }
    }

    this.timeCounter += dt;
    this.timeSinceLastSpherePulse += dt;

    this.emitter.p.copy(this.cursorPtLight.position).addScalar(0.5);
    this.emitterMgr.tick(dt);

    await this.scene.render();
    this.postProcessPipeline.render(dt, VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }

  setAudioInfo(audioInfo) {
    super.setAudioInfo(audioInfo);

    const {chroma:audioChroma, perceptualSharpness, rms, zcr} = audioInfo;
    const {noteColourPalette, cursorMinAtten, cursorMaxAtten, rmsLevelMax} = this.config;

    const rmsPct = THREE.MathUtils.clamp(rms/(0.25*this.currMaxRMS+0.75*rmsLevelMax),0,1);
    const zcrPct = THREE.MathUtils.clamp(zcr/this.currMaxZCR,0,1);
    const weightedRmsZcrPct = 0.55*zcrPct + 0.45*rmsPct;

    this.gaussianBlur.setConfig({sqrSigma: 0.75*rmsPct});
    this.world.gravity.set(0, BASE_GRAVITY + 10*(zcrPct - rmsPct), 0);

    // Adjust the emitter initializers and behaviours to react to the audio
    this.emitterColourBehaviour.reset([chroma(0xFFFFFF).luminance(Math.min(1, Math.max(rms, rmsPct))).hex()]);
    this.emitterVelInit.speedSpan.a = THREE.MathUtils.lerp(6,12,weightedRmsZcrPct);
    this.emitterVelInit.speedSpan.b = THREE.MathUtils.lerp(9,18,weightedRmsZcrPct);
    this.emitter.rate.timePan.a = this.emitter.rate.timePan.b = THREE.MathUtils.lerp(0.08, 0.01, weightedRmsZcrPct);

    // Update the radii of the bounce spheres based on the music...
    const rmsRadiusChange = Math.round(2*(-0.25+weightedRmsZcrPct)*1.5)/2;
    for (const bounceSphere of this.bounceSpheres) {
      const {vtSphere, initRadius} = bounceSphere;
      vtSphere.setRadius(initRadius + rmsRadiusChange);
    }

    // Update the attenuation of the bounce lights based on the music...
    for (const bounceLight of this.bounceLights) {
      const {ptLight, initAtten} = bounceLight;
      const updatedAttenuation = Math.max(cursorMinAtten, initAtten.quadratic - (0.15*initAtten.quadratic*weightedRmsZcrPct));
      ptLight.attenuation.quadratic = updatedAttenuation;
      ptLight.setAttenuation(ptLight.attenuation);
    }

    let colourBlendSpeed = 2; // Number of blends per second
    const requiredRMSDiff = 0.06 * this.config.sphereBurstThresholdMultiplier;
    if (rms > this.avgRMS && (rms-this.avgRMS) > requiredRMSDiff) {
      colourBlendSpeed = 0.3/Math.max(0.001, this.dtAudioFrame);
      if ((perceptualSharpness >= 0.5 || perceptualSharpness <= 0.2) && this.timeSinceLastSpherePulse >= MIN_TIME_BETWEEN_SPHERE_PULSES) {
        const pulseAlpha = Math.min(1, ((rms-this.avgRMS)-requiredRMSDiff) / requiredRMSDiff);
        if (pulseAlpha > 0.2) {
          this._addCursorIntensityPulse(pulseAlpha);
          const w0 = (weightedRmsZcrPct-0.65) / 0.45;
          if (this.bounceLights.length > 0 && w0 >= 0) {
            const maxLights = Math.min(3, this.bounceLights.length); // NOTE: Too many pulses will cause things to slow down a lot!
            const numLights = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(1, maxLights, w0)), 1, maxLights);
            for (let i = 0; i < numLights; i++) {
              const {ptLight} = this.bounceLights[i];
              this._addIntensitySpherePulse(ptLight.position, ptLight.colour, pulseAlpha);
            }
          }
        }
      }
    }

    _newPulseColour.setRGB(0,0,0);
    const chromaAdjusted = AudioVisualizerAnimator.calcAudioChromaAdjusted(audioChroma);

    // Chroma is an array of the following note order: [C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B], values in [0,1]
    // Perform a dot product of the chroma vector with the rgb vectors in the current note palette...
    let largestIdx = -1, secondLargestIdx = -1, largestVal = -Infinity, secondLargestVal = -Infinity; // Keep track of the largest and 2nd largest indices for dir lights
    for (let i = 0, chromaLen = chromaAdjusted.length; i < chromaLen; i++) {
      const chromaAdjustedVal = chromaAdjusted[i];
      const noteColour = noteColourPalette[i];

      _tempColour.setRGB(noteColour.r, noteColour.g, noteColour.b);
      _tempColour.multiplyScalar(chromaAdjustedVal);
      _newPulseColour.add(_tempColour);

      if (chromaAdjustedVal > largestVal) {
        secondLargestVal = largestVal;
        secondLargestIdx = largestIdx;
        largestVal = chromaAdjustedVal;
        largestIdx = i;
      }
      else if (chromaAdjustedVal < largestVal && chromaAdjustedVal > secondLargestVal) {
        secondLargestVal = chromaAdjustedVal;
        secondLargestIdx = i;
      }
    }

    if (largestIdx >= 0 && this.dirLight1) {
      const nextDirLight1Colour = noteColourPalette[largestIdx];
      this.dirLight1.colour.setRGB(
        THREE.MathUtils.clamp(this.dirLight1.colour.r + this.dtAudioFrame*colourBlendSpeed*(nextDirLight1Colour.r-this.dirLight1.colour.r), 0,1),
        THREE.MathUtils.clamp(this.dirLight1.colour.g + this.dtAudioFrame*colourBlendSpeed*(nextDirLight1Colour.g-this.dirLight1.colour.g), 0,1),
        THREE.MathUtils.clamp(this.dirLight1.colour.b + this.dtAudioFrame*colourBlendSpeed*(nextDirLight1Colour.b-this.dirLight1.colour.b), 0,1)
      );
      this.dirLight1.setColour(this.dirLight1.colour);
    }
    if (secondLargestIdx >= 0 && this.dirLight2) {
      const nextDirLight2Colour = noteColourPalette[secondLargestIdx];
      this.dirLight2.colour.setRGB(
        THREE.MathUtils.clamp(this.dirLight2.colour.r + this.dtAudioFrame*colourBlendSpeed*(nextDirLight2Colour.r-this.dirLight2.colour.r), 0,1),
        THREE.MathUtils.clamp(this.dirLight2.colour.g + this.dtAudioFrame*colourBlendSpeed*(nextDirLight2Colour.g-this.dirLight2.colour.g), 0,1),
        THREE.MathUtils.clamp(this.dirLight2.colour.b + this.dtAudioFrame*colourBlendSpeed*(nextDirLight2Colour.b-this.dirLight2.colour.b), 0,1)
      );
      this.dirLight2.setColour(this.dirLight2.colour);
    }

    const currCursorColour = this.cursorPtLight.colour;
    const {rightTrigger} = this.currButtonState;
    _newPulseColour.multiplyScalar(Math.max(2, 1.5+rmsPct));
    _newPulseColour.setRGB(
      THREE.MathUtils.clamp(currCursorColour.r + this.dtAudioFrame*colourBlendSpeed*(Math.max(rightTrigger, Math.min(1, _newPulseColour.r))-currCursorColour.r),0,1),
      THREE.MathUtils.clamp(currCursorColour.g + this.dtAudioFrame*colourBlendSpeed*(Math.max(rightTrigger, Math.min(1, _newPulseColour.g))-currCursorColour.g),0,1),
      THREE.MathUtils.clamp(currCursorColour.b + this.dtAudioFrame*colourBlendSpeed*(Math.max(rightTrigger, Math.min(1, _newPulseColour.b))-currCursorColour.b),0,1)
    );

    // Make the cursor pulse to the beat
    const audioPulseAmt = 1 - rmsPct;
    const pulse = cursorMinAtten + THREE.MathUtils.smoothstep(Math.min((1.0-this.currButtonState.rightTrigger), audioPulseAmt), 0, 1)*(cursorMaxAtten-cursorMinAtten);
    this.cursorPtLight.setAttenuation({quadratic:(pulse*0.75 + this.cursorPtLight.attenuation.quadratic*0.25), linear:0});
    this.cursorPtLight.setColour(_newPulseColour);
    this.ambientLight.colour.setRGB(0.25*_newPulseColour.r, 0.25*_newPulseColour.g, 0.25*_newPulseColour.b);
    this.ambientLight.setColour(this.ambientLight.colour);
  }

  onGamepadAxisEvent(axisEvent) {
    // axisEvent.stick Values: 0,1: Left,Right Analog Sticks
    // axisEvent.axis  Values: 0,1: X,Y Axis
    // axisEvent.value Values: Negative is left or up, Positive is right or down
    const {leftStick,rightStick} = this.currAxisState;
    leftStick.x  = (axisEvent.stick === 0 && axisEvent.axis === 0) ? axisEvent.value  : leftStick.x;
    leftStick.y  = (axisEvent.stick === 0 && axisEvent.axis === 1) ? -axisEvent.value : leftStick.y;
    rightStick.x = (axisEvent.stick === 1 && axisEvent.axis === 0) ? axisEvent.value  : rightStick.x;
    rightStick.y = (axisEvent.stick === 1 && axisEvent.axis === 1) ? axisEvent.value  : rightStick.y;
  }

  onGamepadButtonEvent(buttonEvent) {

    // buttonEvent.button Values:
    // 0,1,2,3 : A (south), B (east), X (west), Y (north) Buttons
    // 4,5: Left, Right Bumper
    // 6,7: Left, Right Trigger
    // 8,9: Select, Start Buttons
    // 10,11: Left, Right Analog Buttons
    // 12,13,14,15: D-PAD Up,Down,Left,Right Buttons
    // 16: XBox Button

    const intensityPulseEvent  = this._addCursorIntensityPulse.bind(this);
    const addBounceSphereEvent = this._addBounceSphere.bind(this);
    const addBounceLightEvent  = this._addBounceLight.bind(this);
    const toggleParticleEvent  = this._toggleParticles.bind(this); 

    switch (buttonEvent.button) {
      case 0: this._updateOnOffButton('south', buttonEvent, intensityPulseEvent); break;
      case 1: this._updateOnOffButton('east',  buttonEvent, addBounceLightEvent); break;
      case 2: this._updateOnOffButton('west',  buttonEvent, addBounceSphereEvent); break;
      case 3: this._updateOnOffButton('north', buttonEvent); break;

      case 4: this._updateOnOffButton('leftBumper', buttonEvent, toggleParticleEvent); break;
      case 5: this._updateOnOffButton('rightBumper', buttonEvent); break;

      case 6: 
        this.currButtonState.leftTrigger = buttonEvent.value;
        this.chromaticAbr.setConfig({intensity: buttonEvent.value*2});
        break;
      case 7: this.currButtonState.rightTrigger = buttonEvent.value; break;

      case 8: this._updateOnOffButton('select', buttonEvent); break;
      case 9: this._updateOnOffButton('start', buttonEvent); break;

      case 10: this._updateOnOffButton('leftAnalog', buttonEvent); break;
      case 11: this._updateOnOffButton('rightAnalog', buttonEvent); break;

      case 12: this._updateOnOffButton('dPadUp', buttonEvent); break;
      case 13: this._updateOnOffButton('dPadDown', buttonEvent); break;
      case 14: this._updateOnOffButton('dPadLeft', buttonEvent); break;
      case 15: this._updateOnOffButton('dPadRight', buttonEvent); break;

      case 16: this._updateOnOffButton('special', buttonEvent); break;

      default: break;
    }
  }

  onGamepadStatusEvent(statusEvent) { if (statusEvent.status === 0) { this._resetControllerState(); } }

  _updateOnOffButton(buttonName, buttonEvent, buttonPressedFunc = () => (null), buttonUnpressedFunc = () => (null)) {
    if (buttonEvent.pressed) { buttonPressedFunc(); }
    else { buttonUnpressedFunc(); }
    this.currButtonState[buttonName] = buttonEvent.value;
  }

  _addCursorIntensityPulse(alpha) {
    this._addIntensitySpherePulse(this.cursorPtLight.position, this.cursorPtLight.colour, alpha || this.avgRMSPercent());
  }

  _addIntensitySpherePulse(center, colour, alpha) {
    if (this.timeSinceLastSpherePulse < MIN_TIME_BETWEEN_SPHERE_PULSES) { return; }

    const spherePulse = this.spherePulses[this.currSpherePulseIdx];
    this.currSpherePulseIdx = (this.currSpherePulseIdx+1) % this.spherePulses.length;

    const {sphere} = spherePulse;
    sphere.position.copy(center);
    sphere.position.addScalar(VoxelConstants.VOXEL_HALF_UNIT_SIZE); // Center it on the cursor's voxel exactly
    sphere.setRadius(VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS);
    sphere.drawOrder = 5;

    const sphereMaterial = sphere.material;
    sphereMaterial.alpha = alpha;
    sphereMaterial.setColour(colour);
    sphere.setMaterial(sphereMaterial);
    spherePulse.currAlpha  = sphereMaterial.alpha;
    spherePulse.currRadius = sphere.radius;

    spherePulse.active = true;
    this.timeSinceLastSpherePulse = 0;
  }

  _addBounceSphere() {
    if (this.bounceSpheres.length >= MAX_BOUNCE_SPHERES) { return; } // Avoid excessive bouncy balls or things get sllloooowwww

    const currRMSVal = this.avgRMSPercent();
    const radius = Math.round(2*(1.5 + 1.5*currRMSVal + Randomizer.getRandomFloat(0,1)))/2;
    const {position} = this.cursorPtLight;
    const spherePos = new THREE.Vector3(
      Math.min(Math.max(position.x, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(position.y, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(position.z, radius), VoxelConstants.VOXEL_GRID_SIZE-radius)
    );

    const vtSphere = new VTSphere(spherePos, radius,  
      new VTLambertMaterial(new THREE.Color(1,1,1)), {samplesPerVoxel:4, fill:false, castsShadows:false, receivesShadows:false}
    );
    vtSphere.drawOrder = 5;

    const randVelocityVec = Randomizer.getRandomUnitVec(_tempVec3).multiplyScalar(Randomizer.getRandomFloat(2,4) + currRMSVal*5);

    const sphereShape = new CANNON.Sphere(radius);
    const sphereBody  = new CANNON.Body({
      mass: calcSphereMass(radius, Randomizer.getRandomFloat(0.25,1.75)),
      position: new CANNON.Vec3(spherePos.x, spherePos.y, spherePos.z),
      material: this.sphereMaterial,
      collisionFilterGroup: SPHERE_COLLISION_GRP,
      collisionFilterMask: WALL_COLLISION_GRP | SPHERE_COLLISION_GRP,
      velocity: (new CANNON.Vec3()).copy(randVelocityVec),
    });
    sphereBody.addShape(sphereShape);
    sphereBody.linearDamping  = 0.01;
    this.world.addBody(sphereBody);

    this.scene.addObject(vtSphere);

    this.bounceSpheres.push({
      currLifeTimeInSecs:0, 
      totalLifeTimeInSecs:5+Randomizer.getRandomFloat(3,8), 
      initRadius:radius, 
      vtSphere, sphereBody, sphereShape
    });
  }

  _addBounceLight() {
    if (this.bounceLights.length >= MAX_BOUNCE_LIGHTS) { return; } // Support a max of 4 bounce lights (otherwise things get slow!)

    const currRMSVal = this.avgRMSPercent();
    const radius = 0.5;
    const {position} = this.cursorPtLight;
    const spherePos = new THREE.Vector3(
      Math.min(Math.max(position.x, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(position.y, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(position.z, radius), VoxelConstants.VOXEL_GRID_SIZE-radius)
    );
    
    const {colour:cursorColour} = this.cursorPtLight;
    const randomScribColour = SCRIABIN_NOTE_COLOURS[Randomizer.getRandomIntInclusive(0, SCRIABIN_NOTE_COLOURS.length-1)];
    const mixColour = chroma.mix(
      cursorColour.getHex(), chroma.gl(randomScribColour.r, randomScribColour.g, randomScribColour.b, 1), 
      Randomizer.getRandomFloat(0.2, 0.8), 'lrgb'
    ).saturate(2).hex();

    const initAtten = {quadratic:2/(2*radius), linear:1};

    const ptLight = new VTPointLight(
      spherePos, new THREE.Color(mixColour), initAtten, true
    );
    ptLight.drawOrder = 5;

    const randVelocityVec = Randomizer.getRandomUnitVec(_tempVec3).multiplyScalar(Randomizer.getRandomFloat(1,3) + currRMSVal*3);

    const lightShape = new CANNON.Sphere(radius);
    const lightBody  = new CANNON.Body({
      mass: 0.1,
      position: new CANNON.Vec3(spherePos.x, spherePos.y, spherePos.z),
      material: this.lightMaterial,
      collisionFilterGroup: LIGHT_COLLISION_GRP,
      collisionFilterMask: WALL_COLLISION_GRP | SPHERE_COLLISION_GRP,
      velocity: (new CANNON.Vec3()).copy(randVelocityVec),
    });
    lightBody.addShape(lightShape);
    lightBody.linearDamping  = 0.01;
    this.world.addBody(lightBody);

    this.scene.addObject(ptLight);
    this.bounceLights.push({
      currLifeTimeInSecs:0, 
      totalLifeTimeInSecs:10+Randomizer.getRandomFloat(0,5), 
      initAtten:{...initAtten}, 
      ptLight, lightBody, lightShape
    });
  }

  _toggleParticles() { 
    if (this.emitterOn) { this.emitter.stopEmit(); this.emitterOn = false; }
    else { this.emitter.startEmit(Infinity); this.emitterOn = true; }
  }
}

export default GamepadDJAnimator;