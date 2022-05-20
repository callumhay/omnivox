import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';

import ControllerClient from './ControllerClient';
import SoundManager from './SoundManager';
import GamepadManager from './GamepadManager';

// Setup audio capture and visualization
const audioVisEl = document.getElementById('audioVisContainer');
const renderer = new THREE.WebGLRenderer();
renderer.autoClear = false;
renderer.setSize(audioVisEl.clientWidth-16, audioVisEl.clientHeight-40);
renderer.domElement.style.margin = "12px auto";
audioVisEl.appendChild(renderer.domElement);
const soundManager = new SoundManager(renderer);

// Central communication class for the controller
const client = new ControllerClient(soundManager);

// Setup gamepad controller capture
const gamepadManager = new GamepadManager(client);
gamepadManager.start();

let lastFrameTime = Date.now();
let sampleAudioTime = 0;
const TIME_BETWEEN_AUDIO_SAMPLES = 1.0 / VoxelConstants.NUM_AUDIO_SAMPLES_PER_SEC;

const render = function () {
  let currFrameTime = Date.now();
  let dt = (currFrameTime - lastFrameTime) / 1000;

  requestAnimationFrame(render);

  // Avoid overwhelming the server by only sending audio samples at a reasonable frequency
  sampleAudioTime += dt;
  if (sampleAudioTime >= TIME_BETWEEN_AUDIO_SAMPLES) {
    soundManager.sample(client);
    sampleAudioTime -= TIME_BETWEEN_AUDIO_SAMPLES;
  }
  soundManager.render();
}

render();
client.start();