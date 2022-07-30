import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

import VoxelDisplay from './VoxelDisplay';
import ViewerClient from './ViewerClient';
import SoundPlayer from './SoundPlayer';

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
// Setup the sound player for music/sfx
const soundPlayer = new SoundPlayer();
// Setup the client (receives render messages from the server and sends control messages to the server)
const viewerClient = new ViewerClient(voxelDisplay, soundPlayer);

// Make sure the camera is positioned somewhere where we can see everything we need to at initial render
scene.position.set(0,0,0);
camera.position.set(0,0,10);

controls.target = new THREE.Vector3(0,0,0);
controls.update();

// Constants used to make window resizing a bit more user-friendly
const originalTanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
const originalWindowHeight = window.innerHeight;

// Event Listeners
// -----------------------------------------------------------------------------
window.addEventListener('resize', onWindowResize, false);
function onWindowResize(ev) {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = (360 / Math.PI) * Math.atan(originalTanFOV * (window.innerHeight / originalWindowHeight));
  camera.updateProjectionMatrix();
  camera.lookAt(scene.position);

  controls.update();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}
window.addEventListener('keypress', onWindowKeyPress, false);
function onWindowKeyPress(ev) {
  switch (ev.key) {
    case 'o': case 'O':
      voxelDisplay.setOrbitModeEnabled(!voxelDisplay.orbitModeEnabled);
      break;
    case 'l': case 'L':
      voxelDisplay.setOutlinesEnabled(!voxelDisplay.outlinesEnabled);
      break;
    default:
      break;
  }
  //console.log(ev);
}
// ------------------------------------------------------------------------------

let frameCount = 0;
let lastFrameTime = Date.now();
const render = function () {
  let currFrameTime = Date.now();
  //let dt = (currFrameTime - lastFrameTime) / 1000;

  requestAnimationFrame(render);

  // Updates for controls/sound/etc.
  controls.update();

  
  // Rendering
  renderer.clear();
  renderer.render(scene, camera);
  
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

viewerClient.start();
