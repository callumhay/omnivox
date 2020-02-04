import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import VoxelDisplay from './VoxelDisplay';
import { Vector3, Color } from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Build the voxel grid
const cubes = new VoxelDisplay(scene);
cubes.drawLine(new THREE.Vector3(0,0,0), new THREE.Vector3(4,4,4), new THREE.Color(1,0,0))

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

function voxelAnimate(voxels, dt, animator) {
  if (!animator) { return; }
  animator.animate(voxels, dt);
}

class VoxelAnimator {
  constructor() {
    
  }

  animate(voxels, dt) {

  }
}

class WaveAnimator extends VoxelAnimator {
  constructor(colours, dirX, dirY, dirZ) {
    super();
    this.colours = colours;
  }

  animate(voxels, dt) {
    super.animate(voxels, dt);

    // Go through each voxel and update it so that it displays the wave animation...


  }
};

//clearRGB(cubes, 1, 0, 0);

let currAnimator = null;
let lastFrameTime = Date.now();

const animate = function () {
  let currFrameTime = Date.now();
  let dt = (currFrameTime - lastFrameTime) / 1000;
  voxelAnimate(cubes, dt, currAnimator);

  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);

  lastFrameTime = currFrameTime;
};
animate();


