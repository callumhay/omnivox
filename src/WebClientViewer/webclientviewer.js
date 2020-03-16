import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

import ControlPanel from './ControlPanel';
import VoxelDisplay from './VoxelDisplay';
import VoxelClient from './VoxelClient';

// Setup THREE library boilerplate for getting a scene + camera + basic controls up and running
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);

// Setup the visualizer for rendering the voxels
const voxelDisplay = new VoxelDisplay(scene);
// Setup the client (recieves render messages from the server and sends control messages to the server)
const voxelClient = new VoxelClient(voxelDisplay);
// Control panel for user interaction / changing routines
const controlPanel = new ControlPanel(voxelClient);

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
  controls.update();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}
// ------------------------------------------------------------------------------

const animate = function () {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};
animate();

voxelClient.start(controlPanel);
