import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

import ControlPanel from './ControlPanel';

import VoxelDisplay from './VoxelDisplay';
import ShootingStarAnimator from './Animation/ShootingStarAnimator';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Build the voxel grid
const voxels = new VoxelDisplay(scene);

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

//clearRGB(voxels, 1, 0, 0);
//voxels.drawLine(new THREE.Vector3(0,0,0), new THREE.Vector3(4,4,4), new THREE.Color(1,0,0))
//voxels.addToVoxel(new THREE.Vector3(0,0,0), new THREE.Color(0,1,0));


const shootingStarSpeed = 5;
const shootingStar = new ShootingStarAnimator(voxels, {
  colour: new THREE.Color(1, 0, 1),
  startPosition: new THREE.Vector3(7, 7, 7),
  velocity: new THREE.Vector3(-shootingStarSpeed, -shootingStarSpeed, -shootingStarSpeed),
  fadeTimeSecs: Math.PI / shootingStarSpeed,
});

const controlPanelGui = new ControlPanel(voxels);

let lastFrameTime = Date.now();
const animate = function () {

  const currAnimator = controlPanelGui.currAnimator;

  let currFrameTime = Date.now();
  let dt = (currFrameTime - lastFrameTime) / 1000;

  //voxels.clearRGB(0,0,0);
  if (currAnimator) {
    currAnimator.animate(dt);
  }
  
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);

  lastFrameTime = currFrameTime;
};



animate();


