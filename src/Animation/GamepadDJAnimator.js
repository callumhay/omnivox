import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import AudioVisualizerAnimator from './AudioVisualizerAnimator';

import VoxelConstants from '../VoxelConstants';

import VTPointLight from '../VoxelTracer/VTPointLight';
import {VTFogSphere } from '../VoxelTracer/VTFog';
import VoxelGeometryUtils from '../VoxelGeometryUtils';
import { defaultSphereOptions, VTSphere } from '../VoxelTracer/VTSphere';
import VTEmissionMaterial from '../VoxelTracer/VTEmissionMaterial';

// Default note-to-colour palette:
// [C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B]
// Based on Alexander Scriabin's synethesthetic scheme, see: https://en.wikipedia.org/wiki/Chromesthesia
const SCRIABIN_NOTE_COLOURS = [
  {r: 1.000, g: 0.008, b: 0.000}, // C: Intense Red (#ff0200)
  {r: 0.569, g: 0.008, b: 0.996}, // C♯: Violet (#9102fe)
  {r: 0.992, g: 1.000, b: 0.000}, // D: Yellow (#fdff00)
  {r: 0.725, g: 0.267, b: 0.545}, // D♯: Mulberry (#b9448b)
  {r: 0.776, g: 0.949, b: 0.996}, // E: Pale Blue/Cobalt (#c6f2fe)
  {r: 0.678, g: 0.000, b: 0.188}, // F: Rose (#ad0030)
  {r: 0.502, g: 0.549, b: 0.992}, // F♯ Cornflower Blue (#808cfd)
  {r: 1.000, g: 0.502, b: 0.004}, // G: Orange (#ff8001)
  {r: 0.737, g: 0.463, b: 0.988}, // G♯: Mauve (#bc76fc)
  {r: 0.196, g: 0.804, b: 0.180}, // A: Green (#32cd2e)
  {r: 0.671, g: 0.400, b: 0.486}, // A♯: Puce (#ab667c)
  {r: 0.565, g: 0.796, b: 0.996}, // B: Sky Blue (#90cbfe)
];


export const gamepadDJAnimatorDefaultConfig = {
  noteColourPalette: [...SCRIABIN_NOTE_COLOURS],
};

const CURSOR_MIN_PULSE_ATTEN = 0.2;
const CURSOR_MAX_PULSE_ATTEN = 2.5;
const CURSOR_MAX_SPEED = VoxelConstants.VOXEL_GRID_SIZE*1.8;

const MIN_TIME_BETWEEN_SPHERE_PULSES = 0.5;

const MAX_TRAIL_SPHERE_RADIUS = 6;

const tempVec3 = new THREE.Vector3();
const tempColour1 = new THREE.Color();
const tempColour2 = new THREE.Color();

class GamepadDJAnimator extends AudioVisualizerAnimator {
  constructor(voxelModel, scene, config=gamepadDJAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.scene = scene;
    this._objectsBuilt = false;

    const maxValue = voxelModel.gridSize + VoxelConstants.VOXEL_EPSILON;
    const minValue = -VoxelConstants.VOXEL_EPSILON;
    this.minBoundsPt = new THREE.Vector3(minValue, minValue, minValue);
    this.maxBoundsPt = new THREE.Vector3(maxValue, maxValue, maxValue);

    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_GAMEPAD_DJ; }
  rendersToCPUOnly() { return true; }

  setConfig(c) {
    super.setConfig(c);
    if (!this.scene) { return; }

    this.scene.dispose();

    if (!this._objectsBuilt) {
      this.cursorPtLight = new VTPointLight(this.cursorPos, new THREE.Color(1,1,1), {quadratic:CURSOR_MAX_PULSE_ATTEN, linear:0}, true);
      this.cursorFog = new VTFogSphere(this.cursorPos, VoxelConstants.VOXEL_HALF_GRID_SIZE, {scattering:1, fogColour: new THREE.Color(1,1,1)});
      this.cursorFog.drawOrder = 5;
      
      const {gridSize} = this.voxelModel;
      this.currSpherePulseIdx = 0;
      this.timeSinceLastSpherePulse = MIN_TIME_BETWEEN_SPHERE_PULSES+1;
      const SPHERE_PULSE_BUFFER_SIZE = 5;
      this.spherePulses = Array(SPHERE_PULSE_BUFFER_SIZE).fill(null);
      for (let i = 0; i < SPHERE_PULSE_BUFFER_SIZE; i++) {
        const pulse = {
          active: false,
          growSpeed: gridSize*0.666,
          alphaFadeSpeed: 1.25,
          sphere: new VTSphere(
            new THREE.Vector3(gridSize,gridSize,gridSize), 0, 
            new VTEmissionMaterial(new THREE.Color(1,1,1), 0), 
            {...defaultSphereOptions, castsShadows: false, samplesPerVoxel:1}
          )
        };
        this.spherePulses[i] = pulse;
      }
      this._objectsBuilt = true;
    }


    for (const sp of this.spherePulses) { this.scene.addObject(sp.sphere); }
    this.scene.addLight(this.cursorPtLight);
    this.scene.addFog(this.cursorFog);
  }

  reset() {
    super.reset();

    const halfGridSizeIdx = VoxelConstants.VOXEL_HALF_GRID_SIZE-1;
    this.cursorPos = new THREE.Vector3(halfGridSizeIdx,halfGridSizeIdx,halfGridSizeIdx);
    this.timeCounter = 0;

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
    // Update the position of the cursor:
    // Left analog stick  – Moves the cursor: Up/down is the y-axis, left/right is the x-axis
    // Right analog stick – Moves the cursor: Up/down is the z-axis, left/right is the x-axis
    const {leftStick,rightStick} = this.currAxisState;

    tempVec3.set(Math.abs(leftStick.x) > Math.abs(rightStick.x) ? leftStick.x : rightStick.x, leftStick.y, rightStick.y);
    tempVec3.multiplyScalar(CURSOR_MAX_SPEED*dt);

    this.cursorPos.add(tempVec3);
    this.cursorPos.clampScalar(0, VoxelConstants.VOXEL_GRID_SIZE-1);
    this.cursorPtLight.setPosition(this.cursorPos);
    this.cursorFog.setPosition(this.cursorPos);

    // Make the cursor pulse to the beat - use a weighting of loudness (RMS) and percussive vs. pitched (ZCR) metrics
    // to create a believable change in the attenuation of the cursor to correspond to the music
    const rmsEffect = THREE.MathUtils.clamp(this.avgRMS/this.currMaxRMS, 0, 1);
    const zcrEffect = THREE.MathUtils.clamp(this.avgZCR/this.currMaxZCR, 0, 1);
    const pulseRMS = 1 - rmsEffect;
    const pulseZCR = 1 - zcrEffect;
    const pulse = CURSOR_MIN_PULSE_ATTEN + (0.6*pulseZCR + 0.4*pulseRMS)*(CURSOR_MAX_PULSE_ATTEN-CURSOR_MIN_PULSE_ATTEN);
    this.cursorPtLight.setAttenuation({quadratic:pulse, linear:0});

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
        pulse.currRadius += growSpeed*dt;
        sphere.setRadius(pulse.currRadius + dt*growSpeed*(rmsEffect-0.5));

        pulse.currAlpha -= dt*alphaFadeSpeed;
        sphere.material.alpha = Math.max(0, pulse.currAlpha*Math.max(0.5, rmsEffect));
        sphere.material.colour.copy(this.cursorPtLight.colour);//.multiplyScalar(0.25+rmsEffect);
        sphere.setMaterial(sphere.material);
      }
    }

    // Sphere Trail Updating
    if (this.currButtonState.rightTrigger > 0) {
      // Update the current voxel data for the sphere trail based on how much the trigger is being held down
      tempVec3.copy(this.cursorPos);
      tempVec3.floor();
      const currVoxelId = VoxelGeometryUtils.voxelFlatIdx(tempVec3, this.voxelModel.gridSize);
      const trailMagnitude = THREE.MathUtils.clamp((this.sphereTrailMap[currVoxelId] || 0) + this.currButtonState.rightTrigger, 0, MAX_TRAIL_SPHERE_RADIUS);
      this.sphereTrailMap[currVoxelId] = trailMagnitude;
    }

    this.timeCounter += dt;
    this.timeSinceLastSpherePulse += dt;

    await this.scene.render();
  }


  setAudioInfo(audioInfo) {
    super.setAudioInfo(audioInfo);

    const {chroma, perceptualSharpness, mfcc} = audioInfo;
    const {noteColourPalette} = this.config;

    let colourBlendSpeed = 2; // Number of blends per second
    if (this.avgRMS >= 0.95*this.currMaxRMS) {
      colourBlendSpeed = 0.5/Math.max(0.001, this.dtAudioFrame);
      tempColour1.setRGB(1,1,1);

      //console.log(`${mfcc[0]} ${mfcc[1]}`);

      if (mfcc[0] >= 225 && (perceptualSharpness >= 0.6 || perceptualSharpness <= 0.15) && this.timeSinceLastSpherePulse >= MIN_TIME_BETWEEN_SPHERE_PULSES) {
        // Add an intensity pulse
        const spherePulse = this.spherePulses[this.currSpherePulseIdx];
        this.currSpherePulseIdx = (this.currSpherePulseIdx+1) % this.spherePulses.length;

        const {sphere} = spherePulse;
        sphere.setCenter(this.cursorPos.clone().addScalar(VoxelConstants.VOXEL_HALF_UNIT_SIZE)); // Center it on the cursor's voxel exactly
        sphere.setRadius(VoxelConstants.VOXEL_DIAGONAL_ERR_UNITS);

        const sphereMaterial = sphere.material;
        sphereMaterial.alpha = 1;
        sphereMaterial.colour.copy(this.cursorPtLight.colour);
        sphere.setMaterial(sphereMaterial);
        spherePulse.currAlpha  = sphereMaterial.alpha;
        spherePulse.currRadius = sphere.radius;

        spherePulse.active = true;
        this.timeSinceLastSpherePulse = 0;
      }

    }
    else {
      tempColour1.setRGB(0,0,0);
      const chromaSum = chroma.reduce((a,b) => a+b, 0) || 1;
      const chromaMean = chromaSum / chroma.length;
      let chromaAdjusted = chroma.map(val => val-chromaMean);
      const chromaMax = chromaAdjusted.reduce((a,b) => Math.max(a,b), 0);
      const chromaMultiplier = 1.0 / chromaMax;
      chromaAdjusted = chromaAdjusted.map(val => chromaMultiplier*val);

      // Chroma is an array of the following note order: [C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B], values in [0,1]
      // Perform a dot product of the chroma vector with the rgb vectors in the current note palette...
      for (let i = 0; i < chroma.length; i++) {
        tempColour2.setRGB(noteColourPalette[i].r, noteColourPalette[i].g, noteColourPalette[i].b);
        tempColour2.multiplyScalar(chromaAdjusted[i]);
        tempColour1.add(tempColour2);
      }
      tempColour1.multiplyScalar(Math.max(2, 1+this.avgRMS));
    }
    

    const currCursorColour = this.cursorPtLight.colour;
    
    tempColour1.setRGB(
      THREE.MathUtils.clamp(currCursorColour.r + this.dtAudioFrame*colourBlendSpeed*(Math.min(1, tempColour1.r)-currCursorColour.r),0,1),
      THREE.MathUtils.clamp(currCursorColour.g + this.dtAudioFrame*colourBlendSpeed*(Math.min(1, tempColour1.g)-currCursorColour.g),0,1),
      THREE.MathUtils.clamp(currCursorColour.b + this.dtAudioFrame*colourBlendSpeed*(Math.min(1, tempColour1.b)-currCursorColour.b),0,1)
    );
    this.cursorPtLight.setColour(tempColour1.clone());
  }

  onGamepadAxisEvent(axisEvent) {
    // axisEvent.stick Values: 0,1: Left,Right Analog Sticks
    // axisEvent.axis  Values: 0,1: X,Y Axis
    // axisEvent.value Values: Negative is left or up, Positive is right or down
    const {leftStick,rightStick} = this.currAxisState;
    leftStick.x  = (axisEvent.stick === 0 && axisEvent.axis === 0) ? axisEvent.value : leftStick.x;
    leftStick.y  = (axisEvent.stick === 0 && axisEvent.axis === 1) ? -axisEvent.value : leftStick.y;
    rightStick.x = (axisEvent.stick === 1 && axisEvent.axis === 0) ? axisEvent.value : rightStick.x;
    rightStick.y = (axisEvent.stick === 1 && axisEvent.axis === 1) ? axisEvent.value : rightStick.y;
  }
  onGamepadButtonEvent(buttonEvent) {
    // buttonEvent.button Values:
    // 0,1,2,3 : A,B,X,Y Buttons
    // 4,5: Left, Right Bumper
    // 6,7: Left, Right Trigger
    // 8,9: Select, Start Buttons
    // 10,11: Left, Right Analog Buttons
    // 12,13,14,15: D-PAD Up,Down,Left,Right Buttons
    // 16: XBox Button

    switch (buttonEvent.button) {
      case 0: this._updateOnOffButton('south', buttonEvent); break;
      case 1: this._updateOnOffButton('east',  buttonEvent); break;
      case 2: this._updateOnOffButton('west',  buttonEvent); break;
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


  _updateOnOffButton(buttonName, buttonEvent) {
    if (!this.currButtonState[buttonName] && buttonEvent.value) {
      // Button was just pressed

    }
    else if (this.currButtonState[buttonName] && !buttonEvent.value) {
      // Button was just unpressed

    }
    this.currButtonState[buttonName] = buttonEvent.value;
  }
}

export default GamepadDJAnimator;