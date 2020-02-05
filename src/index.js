import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import VoxelDisplay, {BLEND_MODE_ADDITIVE} from './VoxelDisplay';
import {VOXEL_EPSILON} from './MathUtils';

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

function voxelAnimate(dt, animator) {
  if (!animator) { return; }
  animator.animate(dt);
}

class VoxelAnimator {
  constructor(voxels, config) {
    this.voxels = voxels;
    this.config = config;
  }

  animate(dt) {

  }
}

/**
 * The ShootingStarAnimator will animate a single "shooting star", a voxel
 * that has a tail which moves from a given starting position in a given
 * direction until it has left the display.
 */
const shootingStarAnimatorDefaultConfig = {
  colour: {r:1, g:1, b:1},
  startPosition: {x:0, y:0, z:0},
  velocity: {x:1, y:0, z:0},
  tailLength: 4,
};
class ShootingStarAnimator extends VoxelAnimator {
  constructor(voxels, config = shootingStarAnimatorDefaultConfig) {
    super(voxels, config);

    const {colour, startPosition, velocity} = config;

    this.colour = new THREE.Color(colour.r, colour.g, colour.b);
    this.startPosition = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    this.currPosition = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    this.velocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
  }

  animate(dt) {
    super.animate(dt);

    // The current position will be the brightest, followed by a tail as defined in the configuration
    const {tailLength} = this.config;
    
    // The tail only starts after the 'star' is moving
    const distanceFromStart = this.currPosition.distanceTo(this.startPosition);
    const actualTailLength = Math.min(distanceFromStart, tailLength);

    // Start at the current position and trace backwards multiple times, shortening the the tail length
    // each time and thereby applying more brightness as the tail gets closer to the current position.
    const stepUnits = this.voxels.voxelSizeInUnits() / (2 + VOXEL_EPSILON); // Sample at a reasonable enough rate
    const numSteps = Math.max(1.0, Math.ceil(actualTailLength / stepUnits));
    const nVelocity = this.velocity.clone().normalize();

    const samples = [];
    for (let i = 0; i < numSteps; i++) {
      const stepVal = i*stepUnits;
      const currPt = this.currPosition.clone().sub(nVelocity.clone().multiplyScalar(stepVal+VOXEL_EPSILON));
      samples.push(currPt.round());
    }
    
    const currBlendMode = this.voxels.blendMode;
    this.voxels.blendMode = BLEND_MODE_ADDITIVE;

    const uniqueSamples = samples.filter((value, index, self) => (self.indexOf(value) === index));
    uniqueSamples.forEach((value, idx) => {
      this.voxels.drawPoint(value, this.colour.clone().multiplyScalar(1.0 / (1.0 + idx)));
    });

    this.voxels.blendMode = currBlendMode;

    this.currPosition.add(this.velocity.clone().multiplyScalar(dt));
  }
};

//clearRGB(voxels, 1, 0, 0);
//voxels.drawLine(new THREE.Vector3(0,0,0), new THREE.Vector3(4,4,4), new THREE.Color(1,0,0))
//voxels.addToVoxel(new THREE.Vector3(0,0,0), new THREE.Color(0,1,0));

let currAnimator = new ShootingStarAnimator(voxels, {
  colour: new THREE.Color(1, 0, 1),
  startPosition: new THREE.Vector3(7, 7, 7),
  velocity: new THREE.Vector3(-0.5, -0.5, 0),
  tailLength: 5,
});

let lastFrameTime = Date.now();
const animate = function () {
  let currFrameTime = Date.now();
  let dt = (currFrameTime - lastFrameTime) / 1000;

  // Clear the voxels at the start of the frame
  voxels.clearRGB(0,0,0);
  voxelAnimate(dt, currAnimator);

  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);

  lastFrameTime = currFrameTime;
};
animate();


