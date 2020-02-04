import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var controls = new OrbitControls(camera, renderer.domElement);

const texelUnitSize = 1.0;
const ledUnitSize = texelUnitSize / 2.0;

var ledGeometry = new THREE.BoxGeometry(ledUnitSize, ledUnitSize, ledUnitSize);
var outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(texelUnitSize, texelUnitSize, texelUnitSize));

var ledMaterial = new THREE.MeshBasicMaterial({color: 0x00ff00});
var outlineMaterial = new THREE.LineBasicMaterial({color: 0xffffff});
outlineMaterial.transparent = true;
outlineMaterial.opacity = 0.25;

// Build the texel grid
const texelGridSize = 4;
const xSize = texelGridSize;
const ySize = texelGridSize;
const zSize = texelGridSize;

const cubes = [];

for (let x = 0; x < xSize; x++) {
    let currXArr = [];
    cubes.push(currXArr);
    for (let y = 0; y < ySize; y++) {
        let currYArr = [];
        currXArr.push(currYArr);
        for (let z = 0; z < zSize; z++) {

            const ledMesh = new THREE.Mesh(ledGeometry, ledMaterial);
            const outlineMesh = new THREE.LineSegments(outlineGeometry, outlineMaterial);

            const currZObj = {
                xIndex: x,
                yIndex: y,
                zIndex: z,
                ledMesh: ledMesh,
                outlineMesh: outlineMesh,
            };

            scene.add(ledMesh);
            scene.add(outlineMesh);
            
            ledMesh.position.set(x,y,z);
            outlineMesh.position.set(x,y,z);

            currYArr.push(currZObj);
        }
    }
}

camera.position.z = 10;
controls.update();

let tanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
let windowHeight = window.innerHeight;

const animate = function () {
  requestAnimationFrame(animate);

  //cube.rotation.x += 0.01;
  //cube.rotation.y += 0.01;
  controls.update();
  renderer.render(scene, camera);
};

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

animate();