import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import AudioVisualizerAnimator from './AudioVisualizerAnimator';

import VoxelConstants from '../VoxelConstants';

import VTPointLight from '../VoxelTracer/VTPointLight';
import {VTFogBox, fogDefaultOptions, VTFogSphere } from '../VoxelTracer/VTFog';

export const gamepadDJAnimatorDefaultConfig = {
};

const CURSOR_MIN_PULSE_ATTEN = 0.2;
const CURSOR_MAX_PULSE_ATTEN = 2.4;
const CURSOR_MAX_SPEED = VoxelConstants.VOXEL_GRID_SIZE*1.8;

const tempVec3 = new THREE.Vector3();

class GamepadDJAnimator extends AudioVisualizerAnimator {
  constructor(voxelModel, scene, config=gamepadDJAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.scene = scene;
    this._objectsBuilt = false;
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

      this._objectsBuilt = true;
    }

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
    const pulseRMS = 1 - THREE.MathUtils.clamp(this.avgRMS/this.currMaxRMS, 0, 1);
    const pulseZCR = 1 - THREE.MathUtils.clamp(this.avgZCR/this.currMaxZCR, 0, 1);
    const pulse = CURSOR_MIN_PULSE_ATTEN + (0.6*pulseZCR + 0.4*pulseRMS)*(CURSOR_MAX_PULSE_ATTEN-CURSOR_MIN_PULSE_ATTEN);
    this.cursorPtLight.setAttenuation({quadratic:pulse, linear:0});


    //console.log("Avg ZCR: " + this.avgZCR);

    this.timeCounter += dt;

    await this.scene.render();
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

  setAudioInfo(audioInfo) {
    super.setAudioInfo(audioInfo);
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

}

export default GamepadDJAnimator;