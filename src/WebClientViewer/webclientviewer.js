import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

import ControlPanel from './ControlPanel';
import VoxelDisplay from './VoxelDisplay';
import VoxelClient from './VoxelClient';

// Setup the Editor...
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Build the voxel grid
const voxelDisplay = new VoxelDisplay(scene);

scene.position.set(0,0,0);
camera.position.z = 0;
camera.position.y = 0;
camera.position.z = 10;

controls.update();

let tanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
let windowHeight = window.innerHeight;

// Event Listeners
// -----------------------------------------------------------------------------
window.addEventListener('resize', onWindowResize, false);
function onWindowResize(event) {
  camera.aspect = window.innerWidth / window.innerHeight;

  // adjust the FOV
  camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (window.innerHeight / windowHeight));

  camera.updateProjectionMatrix();
  camera.lookAt(scene.position);
  controls.update();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}


// Setup the client (recieves render messages from the server and sends control messages to the server)
const voxelClient = new VoxelClient(voxelDisplay);

// Control panel for user interaction / changing routines
const controlPanel = new ControlPanel(voxelClient);

//let lastFrameTime = Date.now();
const animate = function () {

  //let currFrameTime = Date.now();
  //let dt = (currFrameTime - lastFrameTime) / 1000;

  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);

  //lastFrameTime = currFrameTime;
};

animate();

voxelClient.start(controlPanel);
