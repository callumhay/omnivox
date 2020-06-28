import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

import ControlPanel from './ControlPanel';
import VoxelDisplay from './VoxelDisplay';
import VoxelClient from './VoxelClient';
import SoundController from './SoundController';

// Setup THREE library boilerplate for getting a scene + camera + basic controls up and running
const renderer = new THREE.WebGLRenderer();
renderer.autoClear = false;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);

// Setup the visualizer for rendering the voxels
const voxelDisplay = new VoxelDisplay(scene, controls);
// Setup the client (recieves render messages from the server and sends control messages to the server)
const voxelClient = new VoxelClient(voxelDisplay);
// Setup the sound controller for playing music and capturing audio from the mic
const soundController = new SoundController();
// Control panel for user interaction / changing routines
const controlPanel = new ControlPanel(voxelClient, voxelDisplay, soundController);

// Make sure the camera is positioned somewhere where we can see everything we need to at initial render
scene.position.set(0,0,0);
camera.position.z = 0;
camera.position.y = 0;
camera.position.z = 10;
controls.update();

// Constants used to make window resizing a bit more user-friendly
const originalTanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
const originalWindowHeight = window.innerHeight;

// Event Listeners
// -----------------------------------------------------------------------------
window.addEventListener('resize', onWindowResize, false);
function onWindowResize(event) {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = (360 / Math.PI) * Math.atan(originalTanFOV * (window.innerHeight / originalWindowHeight));
  camera.updateProjectionMatrix();
  camera.lookAt(scene.position);

  soundController.windowResize(originalTanFOV, originalWindowHeight);

  controls.update();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}
// ------------------------------------------------------------------------------


let frameCount = 0;
let lastFrameTime = Date.now();
let sampleAudioTime = 0;
const TIME_BETWEEN_AUDIO_SAMPLES = 1.0 / 60; // 60Hz

const render = function () {
  let currFrameTime = Date.now();
  let dt = (currFrameTime - lastFrameTime) / 1000;

  requestAnimationFrame(render);

  // Updates for controls/sound/etc.
  controls.update();

  // Avoid overwhelming the server by only sending audio samples at a reasonable frequency
  sampleAudioTime += dt;
  if (sampleAudioTime >= TIME_BETWEEN_AUDIO_SAMPLES) {
    soundController.sample(voxelClient);
    sampleAudioTime -= TIME_BETWEEN_AUDIO_SAMPLES;
  }
  
  // Rendering
  renderer.clear();
  renderer.render(scene, camera);
  soundController.render(renderer);
  
  frameCount++;
  /*
  // Every once in a while we request a full state update from the server
  requestStatePingTime += dt;
  if (requestStatePingTime >= TIME_BETWEEN_STATE_PINGS_S) {
    voxelClient.sendRequestFullStateUpdate();
    requestStatePingTime = 0;
  }
  */

};
render();

voxelClient.start(controlPanel);
