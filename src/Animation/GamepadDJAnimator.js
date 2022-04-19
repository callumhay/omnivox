import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import chroma from 'chroma-js';

import VoxelAnimator from './VoxelAnimator';
import AudioVisualizerAnimator from './AudioVisualizerAnimator';

import VoxelConstants from '../VoxelConstants';
import PhysicsUtils from '../PhysicsUtils';
import {SCRIABIN_NOTE_COLOURS} from '../Spectrum';
import { Randomizer } from '../Randomizers';

import VTPointLight from '../VoxelTracer/VTPointLight';
import VTDirectionalLight from '../VoxelTracer/VTDirectionalLight';
import VTAmbientLight from '../VoxelTracer/VTAmbientLight';
import VTEmissionMaterial from '../VoxelTracer/VTEmissionMaterial';
import VTLambertMaterial from '../VoxelTracer/VTLambertMaterial';
import {VTFogBox} from '../VoxelTracer/VTFog';
import VTSphere, {defaultSphereOptions} from '../VoxelTracer/VTSphere';

import VoxelModel from '../Server/VoxelModel';
import VoxelGaussianBlurPP from '../Server/PostProcess/VoxelGaussianBlurPP';
import VoxelPostProcessPipeline from '../Server/PostProcess/VoxelPostProcessPipeline';

export const gamepadDJAnimatorDefaultConfig = {
  noteColourPalette: [...SCRIABIN_NOTE_COLOURS],
};

const WALL_COLLISION_GRP   = 1;
const SPHERE_COLLISION_GRP = 2;
const LIGHT_COLLISION_GRP  = 4;

const CURSOR_MIN_PULSE_ATTEN = 0.2;
const CURSOR_MAX_PULSE_ATTEN = 1.5;
const CURSOR_MAX_SPEED = VoxelConstants.VOXEL_GRID_SIZE;

const MIN_TIME_BETWEEN_SPHERE_PULSES = 1.0;
const BASE_GRAVITY = 0;
const MAX_BOUNCE_LIGHTS = 4;
const MAX_BOUNCE_SPHERES = 6;

const tempVec3 = new THREE.Vector3();
const newPulseColour = new THREE.Color();
const tempColour = new THREE.Color();

class GamepadDJAnimator extends AudioVisualizerAnimator {
  constructor(voxelModel, scene, config=gamepadDJAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.scene = scene;
    this._objectsBuilt = false;

    const maxValue = voxelModel.gridSize + VoxelConstants.VOXEL_EPSILON;
    const minValue = -VoxelConstants.VOXEL_EPSILON;
    this.minBoundsPt = new THREE.Vector3(minValue, minValue, minValue);
    this.maxBoundsPt = new THREE.Vector3(maxValue, maxValue, maxValue);

    this.gaussianBlur = new VoxelGaussianBlurPP(voxelModel);
    this.postProcessPipeline = new VoxelPostProcessPipeline(voxelModel);
    this.postProcessPipeline.addPostProcess(this.gaussianBlur);

    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_GAMEPAD_DJ; }
  rendersToCPUOnly() { return true; }

  setConfig(c) {
    super.setConfig(c);
    if (!this.scene) { return; }

    this.scene.clear();

    if (!this._objectsBuilt) {
      const {gridSize} = this.voxelModel;

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
      const wallBodies = PhysicsUtils.buildSideWalls(VoxelConstants.VOXEL_GRID_SIZE, this.wallMaterial);
      for (const wallBody of wallBodies) { 
        wallBody.collisionFilterGroup = WALL_COLLISION_GRP;
        this.world.addBody(wallBody);
      }

      this.cursorPtLight = new VTPointLight(this.cursorPos, new THREE.Color(1,1,1), {quadratic:CURSOR_MAX_PULSE_ATTEN, linear:0}, true);
      const fogOptions = {scattering:1, colour: new THREE.Color(1,1,1)};
      this.fog = new VTFogBox(new THREE.Vector3(0,0,0), new THREE.Vector3(gridSize, gridSize, gridSize), fogOptions);
      this.fog.drawOrder = 5;
      
      this.dirLight1 = new VTDirectionalLight(new THREE.Vector3(1, -1, 1), new THREE.Color(0,0,0));
      this.dirLight2 = new VTDirectionalLight(new THREE.Vector3(-0.75, -0.2, -0.5), new THREE.Color(0,0,0));
      
      this.ambientLight = new VTAmbientLight(new THREE.Color(0.25, 0.25, 0.25));

      this.currSpherePulseIdx = 0;
      this.timeSinceLastSpherePulse = MIN_TIME_BETWEEN_SPHERE_PULSES+1;
      const SPHERE_PULSE_BUFFER_SIZE = 8;
      this.spherePulses = Array(SPHERE_PULSE_BUFFER_SIZE).fill(null);
      for (let i = 0; i < SPHERE_PULSE_BUFFER_SIZE; i++) {
        const pulse = {
          active: false,
          growSpeed: gridSize*0.5,
          alphaFadeSpeed: 0.33,
          sphere: new VTSphere(
            new THREE.Vector3(gridSize,gridSize,gridSize), 0, 
            new VTEmissionMaterial(new THREE.Color(1,1,1), 0), 
            {...defaultSphereOptions, castsShadows: false, samplesPerVoxel:1}
          )
        };
        this.spherePulses[i] = pulse;
      }

      this.gaussianBlur.setConfig({
        kernelSize: 3,
        sqrSigma: 0,
        conserveEnergy: false
      });

      this._objectsBuilt = true;
    }

    for (const sp of this.spherePulses) { this.scene.addObject(sp.sphere); }
    this.scene.addObject(this.cursorPtLight);
    this.scene.addObject(this.dirLight1);
    this.scene.addObject(this.dirLight2);
    this.scene.addObject(this.fog);
    this.scene.addObject(this.ambientLight);
  }

  reset() {
    super.reset();

    this.world = null;
    this.wallMaterial = null;
    this.sphereMaterial = null;
    this.bounceSpheres = [];
    this.bounceLights  = [];
    this.lastPhysicsWorldStepTime = 0;

    const halfGridSizeIdx = VoxelConstants.VOXEL_HALF_GRID_SIZE-1;
    this.cursorPos = new THREE.Vector3(halfGridSizeIdx,halfGridSizeIdx,halfGridSizeIdx);
    this.timeCounter = 0;
    this.updatePulseColour = false;

    this.cursorPtLight = null;
    this.fog = null;
    this.dirLight1 = null;
    this.dirLight2 = null;
    this.ambientLight = null;

    this.prevBassTotal = 0;
    this.prevBaseDerivative = 0;

    this.sphereTrailMap = {};
    this.sphereTrailList = [];

    this._resetControllerState();
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

  async render(dt) {
    if (!this._objectsBuilt) { return; }

    // Simulate the physics
    const now = Date.now() / 1000;
    if (!this.lastPhysicsWorldStepTime) {
      // Last call time not saved, can't guess elapsed time. Take a simple step.
      this.world.step(dt);
      this.lastPhysicsWorldStepTime = now;
    }
    else {
      let timeSinceLastCall = now - this.lastPhysicsWorldStepTime;
      this.world.step(dt);
      this.world.step(dt, timeSinceLastCall, 20);
      this.lastPhysicsWorldStepTime = now;
    }

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
      vtSphere.center.set(spherePos.x, spherePos.y, spherePos.z);
      vtSphere.setCenter(vtSphere.center);
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

    tempVec3.set(rightStick.x, leftStick.y, rightStick.y);
    tempVec3.multiplyScalar(CURSOR_MAX_SPEED*dt);

    this.cursorPos.add(tempVec3);
    this.cursorPos.clampScalar(0, VoxelConstants.VOXEL_GRID_SIZE-1);
    this.cursorPtLight.setPosition(this.cursorPos);

    // Make the cursor pulse to the beat - use a weighting of loudness (RMS) and percussive vs. pitched (ZCR) metrics
    // to create a believable change in the attenuation of the cursor to correspond to the music
    const rmsEffect = THREE.MathUtils.clamp(this.avgRMS/this.currMaxRMS, 0, 1);
    const zcrEffect = THREE.MathUtils.clamp(this.avgZCR/this.currMaxZCR, 0, 1);
    const pulseRMS = 1 - rmsEffect;
    const pulseZCR = 1 - zcrEffect;
    const pulse = CURSOR_MIN_PULSE_ATTEN + Math.min((1.0-0.9*this.currButtonState.rightTrigger), (0.6*pulseZCR + 0.4*pulseRMS)) * (CURSOR_MAX_PULSE_ATTEN-CURSOR_MIN_PULSE_ATTEN);
    this.cursorPtLight.setAttenuation({quadratic:pulse, linear:0});

    if (this.updatePulseColour) {
      this.cursorPtLight.setColour(newPulseColour.clone());
      this.updatePulseColour = false;
      this.ambientLight.colour.setRGB(0.25*newPulseColour.r, 0.25*newPulseColour.g, 0.25*newPulseColour.b);
      this.ambientLight.setColour(this.ambientLight.colour);
    }

    // Sphere Pulse Updates: When the music gets really intense suddenly we trigger a bright sphere pulse that eminates from the cursor
    const {gridSize} = this.voxelModel;
    for (const pulse of this.spherePulses) {
      const {active, growSpeed, alphaFadeSpeed, sphere, currAlpha} = pulse;
      if (!active) { continue; }
      
      // If the sphere is invisible or is so large that it encompasses the voxel grid, then we deactive it.
      const boundingSphere = sphere.getBoundingSphere();
      if (currAlpha <= 0 || boundingSphere.containsPoint(this.minBoundsPt) && boundingSphere.containsPoint(this.maxBoundsPt)) {
        sphere.material.alpha = 0;
        sphere.setMaterial(sphere.material);
        sphere.setRadius(0);
        sphere.setCenter(new THREE.Vector3(gridSize,gridSize,gridSize));
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
          //sphere.material.colour.copy(this.cursorPtLight.colour);
          sphere.setMaterial(sphere.material);
        }
      }
    }

    this.timeCounter += dt;
    this.timeSinceLastSpherePulse += dt;

    await this.scene.render();

    // Gaussian blur post-processing effect
    this.postProcessPipeline.render(VoxelModel.CPU_FRAMEBUFFER_IDX_0, VoxelModel.CPU_FRAMEBUFFER_IDX_0);
  }

  setAudioInfo(audioInfo) {
    super.setAudioInfo(audioInfo);
    if (!this._objectsBuilt) { return; }

    const {chroma, perceptualSharpness, mfcc, rms, zcr} = audioInfo;
    const {noteColourPalette} = this.config;

    if (mfcc[0] === 0) { return; }

    const rmsPct = THREE.MathUtils.clamp(rms/this.currMaxRMS,0,1);
    const zcrPct = THREE.MathUtils.clamp(zcr/this.currMaxZCR,0,1);
    const weightedRmsZcrPct = 0.55*zcrPct + 0.45*rmsPct;

    this.gaussianBlur.setConfig({sqrSigma: 0.75*rmsPct});
    this.world.gravity.set(0, BASE_GRAVITY + 10*(zcrPct - rmsPct), 0);

    // Update the radii of the bounce spheres based on the music...
    const rmsRadiusChange = Math.round(2*(-0.25+weightedRmsZcrPct)*1.5)/2;
    for (const bounceSphere of this.bounceSpheres) {
      const {vtSphere, initRadius} = bounceSphere;
      vtSphere.setRadius(initRadius + rmsRadiusChange);
    }

    // Update the attenuation of the bounce lights based on the music...
    for (const bounceLight of this.bounceLights) {
      const {ptLight, initAtten} = bounceLight;
      const updatedAttenuation = Math.max(0.03, initAtten.quadratic - (0.5*initAtten.quadratic*weightedRmsZcrPct));
      ptLight.attenuation.quadratic = updatedAttenuation;
      ptLight.setAttenuation(ptLight.attenuation);
    }

    let colourBlendSpeed = 2; // Number of blends per second
    if (rms >= this.currMaxRMS) {
      colourBlendSpeed = 0.5/Math.max(0.001, this.dtAudioFrame);
      if (mfcc[0] >= 220 && (perceptualSharpness >= 0.5 || perceptualSharpness <= 0.2) && this.timeSinceLastSpherePulse >= MIN_TIME_BETWEEN_SPHERE_PULSES) {
        this._addCursorIntensityPulse();
        //console.log("ZCRRMS AVG: " + weightedRmsZcrPct);
        const w0 = (weightedRmsZcrPct-0.65) / 0.45;
        if (this.bounceLights.length > 0 && w0 >= 0) {
          const maxLights = Math.min(3, this.bounceLights.length); // NOTE: Too many pulses will cause things to slow down a lot!
          const numLights = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(1, maxLights, w0)), 1, maxLights);
          for (let i = 0; i < numLights; i++) {
            const {ptLight} = this.bounceLights[i];
            this._addIntensitySpherePulse(ptLight.position, ptLight.colour);
          }
        }
      }
    }

    newPulseColour.setRGB(0,0,0);
    const chromaSum = chroma.reduce((a,b) => a+b, 0) || 1;
    const chromaMean = chromaSum / chroma.length;
    let chromaAdjusted = chroma.map(val => val-chromaMean);
    
    const chromaMax = chromaAdjusted.reduce((a,b) => Math.max(a,b), 0);
    const chromaMultiplier = 1.0 / chromaMax;
    chromaAdjusted = chromaAdjusted.map(val => chromaMultiplier*val);

    // Chroma is an array of the following note order: [C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B], values in [0,1]
    // Perform a dot product of the chroma vector with the rgb vectors in the current note palette...
    let largestIdx = -1, secondLargestIdx = -1, largestVal = -Infinity, secondLargestVal = -Infinity; // Keep track of the largest and 2nd largest indices for dir lights
    for (let i = 0; i < chroma.length; i++) {
      const chromaAdjustedVal = chromaAdjusted[i];

      tempColour.setRGB(noteColourPalette[i].r, noteColourPalette[i].g, noteColourPalette[i].b);
      tempColour.multiplyScalar(chromaAdjustedVal);
      newPulseColour.add(tempColour);

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
    newPulseColour.multiplyScalar(Math.max(2, 1+this.avgRMS));
    newPulseColour.setRGB(
      THREE.MathUtils.clamp(currCursorColour.r + this.dtAudioFrame*colourBlendSpeed*(Math.max(rightTrigger, Math.min(1, newPulseColour.r))-currCursorColour.r),0,1),
      THREE.MathUtils.clamp(currCursorColour.g + this.dtAudioFrame*colourBlendSpeed*(Math.max(rightTrigger, Math.min(1, newPulseColour.g))-currCursorColour.g),0,1),
      THREE.MathUtils.clamp(currCursorColour.b + this.dtAudioFrame*colourBlendSpeed*(Math.max(rightTrigger, Math.min(1, newPulseColour.b))-currCursorColour.b),0,1)
    );
    this.updatePulseColour = true;
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

    const southBtnPressedEvent = this._addCursorIntensityPulse.bind(this);
    const westBtnPressedEvent = this._addBounceSphere.bind(this);
    const eastBtnPressedEvent = this._addBounceLight.bind(this);

    switch (buttonEvent.button) {
      case 0: this._updateOnOffButton('south', buttonEvent, southBtnPressedEvent); break;
      case 1: this._updateOnOffButton('east',  buttonEvent, eastBtnPressedEvent); break;
      case 2: this._updateOnOffButton('west',  buttonEvent, westBtnPressedEvent); break;
      case 3: this._updateOnOffButton('north', buttonEvent); break;

      case 4: this._updateOnOffButton('leftBumper', buttonEvent); break;
      case 5: this._updateOnOffButton('rightBumper', buttonEvent); break;

      case 6: this.currButtonState.leftTrigger  = buttonEvent.value; break;
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

  onGamepadStatusEvent(statusEvent) {
    if (statusEvent.status === 0) { this._resetControllerState(); }
  }

  _updateOnOffButton(buttonName, buttonEvent, buttonPressedFunc = () => (null), buttonUnpressedFunc = () => (null)) {
    if (buttonEvent.value) {
      // Button was pressed
      buttonPressedFunc();
    }
    else {
      // Button was unpressed
      buttonUnpressedFunc();
    }
    this.currButtonState[buttonName] = buttonEvent.value;
  }

  _addCursorIntensityPulse() { 
    this._addIntensitySpherePulse(this.cursorPos, this.cursorPtLight.colour);
  }

  _addIntensitySpherePulse(center, colour) {
    const spherePulse = this.spherePulses[this.currSpherePulseIdx];
    this.currSpherePulseIdx = (this.currSpherePulseIdx+1) % this.spherePulses.length;

    const {sphere} = spherePulse;
    sphere.center.copy(center);
    sphere.setCenter(sphere.center.addScalar(VoxelConstants.VOXEL_HALF_UNIT_SIZE)); // Center it on the cursor's voxel exactly
    sphere.setRadius(VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS);
    sphere.drawOrder = 5;

    const sphereMaterial = sphere.material;
    sphereMaterial.alpha = 1;
    sphereMaterial.colour.copy(colour);
    sphere.setMaterial(sphereMaterial);
    spherePulse.currAlpha  = sphereMaterial.alpha;
    spherePulse.currRadius = sphere.radius;

    spherePulse.active = true;
    this.timeSinceLastSpherePulse = 0;
  }

  _addBounceSphere() {
    if (this.bounceSpheres.length >= MAX_BOUNCE_SPHERES) { return; } // Avoid excessive bouncy balls or things get sllloooowwww

    const currRMSVal = THREE.MathUtils.clamp(this.avgRMS/this.currMaxRMS,0,1);
    const radius = Math.round(2*(2 + 1.5*currRMSVal + Randomizer.getRandomFloat(0,1.5)))/2;
    const spherePos = new THREE.Vector3(
      Math.min(Math.max(this.cursorPos.x, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(this.cursorPos.y, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(this.cursorPos.z, radius), VoxelConstants.VOXEL_GRID_SIZE-radius)
    );

    const vtSphere = new VTSphere(spherePos, radius,  
      new VTLambertMaterial(new THREE.Color(1,1,1)), {samplesPerVoxel:4, fill:false, castsShadows:false}
    );
    vtSphere.drawOrder = 5;

    const sphereShape = new CANNON.Sphere(radius);
    const sphereBody  = new CANNON.Body({
      mass: 4/3 * Math.PI * Math.pow(radius,3) * Randomizer.getRandomFloat(0.25,1.75),
      position: new CANNON.Vec3(spherePos.x, spherePos.y, spherePos.z),
      material: this.sphereMaterial,
      collisionFilterGroup: SPHERE_COLLISION_GRP,
      collisionFilterMask: WALL_COLLISION_GRP,
      velocity: new CANNON.Vec3(
        Randomizer.getRandomPositiveOrNegative() * (currRMSVal*Randomizer.getRandomFloat(1,3) + Randomizer.getRandomFloat(1,2)), 
        Randomizer.getRandomFloat(3,5) + currRMSVal*5, 
        Randomizer.getRandomPositiveOrNegative() * (currRMSVal*Randomizer.getRandomFloat(1,3) + Randomizer.getRandomFloat(1,2))
      ),
    });
    sphereBody.addShape(sphereShape);
    sphereBody.linearDamping  = 0.01;
    this.world.addBody(sphereBody);

    this.scene.addObject(vtSphere);

    this.bounceSpheres.push({
      currLifeTimeInSecs:0, 
      totalLifeTimeInSecs:5+Randomizer.getRandomFloat(0,10), 
      initRadius:radius, 
      vtSphere, sphereBody, sphereShape
    });
  }

  _addBounceLight() {
    if (this.bounceLights.length >= MAX_BOUNCE_LIGHTS) { return; } // Support a max of 4 bounce lights (otherwise things get slow!)

    const currRMSVal = THREE.MathUtils.clamp(this.avgRMS/this.currMaxRMS,0,1);
    const radius = (3 + 2*currRMSVal);
    const spherePos = new THREE.Vector3(
      Math.min(Math.max(this.cursorPos.x, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(this.cursorPos.y, radius), VoxelConstants.VOXEL_GRID_SIZE-radius), 
      Math.min(Math.max(this.cursorPos.z, radius), VoxelConstants.VOXEL_GRID_SIZE-radius)
    );
    
    const {colour:cursorColour} = this.cursorPtLight;
    const colour1 = chroma.gl(cursorColour.r, cursorColour.g, cursorColour.b, 1);
    const randomScribColour = SCRIABIN_NOTE_COLOURS[Randomizer.getRandomIntInclusive(0, SCRIABIN_NOTE_COLOURS.length-1)];
    const colour2 = chroma.gl(randomScribColour.r, randomScribColour.g, randomScribColour.b, 1);
    const mixColour = chroma.mix(colour1, colour2, Randomizer.getRandomFloat(0.2, 0.8), 'lrgb').saturate(2).gl();
    const initAtten = {quadratic:1.0/(1.5*radius), linear:1};

    const ptLight = new VTPointLight(
      spherePos, new THREE.Color(mixColour[0], mixColour[1], mixColour[2]), initAtten, true
    );
    ptLight.drawOrder = 5;

    const lightShape = new CANNON.Sphere(radius);
    const lightBody  = new CANNON.Body({
      mass: 0.1,
      position: new CANNON.Vec3(spherePos.x, spherePos.y, spherePos.z),
      material: this.lightMaterial,
      collisionFilterGroup: LIGHT_COLLISION_GRP,
      collisionFilterMask: WALL_COLLISION_GRP | SPHERE_COLLISION_GRP,
      velocity: new CANNON.Vec3(
        Randomizer.getRandomPositiveOrNegative() * (currRMSVal*Randomizer.getRandomFloat(1,3) + Randomizer.getRandomFloat(1,2)), 
        Randomizer.getRandomFloat(2,3) + currRMSVal*3, 
        Randomizer.getRandomPositiveOrNegative() * (currRMSVal*Randomizer.getRandomFloat(1,3) + Randomizer.getRandomFloat(1,2))
      ),
    });
    lightBody.addShape(lightShape);
    lightBody.linearDamping  = 0.0;
    this.world.addBody(lightBody);

    this.scene.addObject(ptLight);
    this.bounceLights.push({
      currLifeTimeInSecs:0, 
      totalLifeTimeInSecs:10+Randomizer.getRandomFloat(0,5), 
      initAtten:{...initAtten}, 
      ptLight, lightBody, lightShape
    });
  }

}

export default GamepadDJAnimator;