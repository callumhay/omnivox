import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';

const DEFAULT_LED_POINT_SIZE = VoxelConstants.VOXEL_UNIT_SIZE * 2;

const POINTS_VERTEX_SHADER = `
  attribute float size;
  attribute vec3 customColour;

  varying vec3 vColor;

  void main() {
    vColor = customColour/255.0;
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_PointSize = size * (150.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const POINTS_FRAGMENT_SHADER = `
  uniform vec3 color;
  uniform sampler2D pointTexture;

  varying vec3 vColor;

  void main() {
    gl_FragColor = vec4(color * vColor, 1.0);
    gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
    if (gl_FragColor.a < 0.5 || (gl_FragColor.r+gl_FragColor.g+gl_FragColor.b) < 0.01 ) { discard; }
  }
`;

class VoxelDisplay {
  constructor(scene, controls) {
    this._scene = scene;
    this._controls = controls;

    // Settings
    this.outlinesEnabled = false;
    this.orbitModeEnabled = false;

    this.rebuild(VoxelConstants.VOXEL_GRID_SIZE);
  }

  removeVoxels() {
    if (!this.leds) { return; }
    this._scene.remove(this.leds);
    this._scene.remove(this.outlines);
    this.leds = null;
    this.outlines = null;
    this.colourBuffer = null;
  }

  rebuild(gridSize) {

    // Clean up any previous voxel grid
    this.removeVoxels();

    const halfTranslationUnits = (gridSize*VoxelConstants.VOXEL_UNIT_SIZE)/2.0;
    const worldTranslation = new THREE.Vector3(-halfTranslationUnits, -halfTranslationUnits, -halfTranslationUnits);

    this.gridSize = gridSize;
    const numLEDs = this.gridSize*this.gridSize*this.gridSize;

    let ledPositions = new Float32Array(numLEDs*3);
    let ledColours   = new Uint8Array(numLEDs*3).fill(0);
    let ledSizes     = new Float32Array(numLEDs).fill(DEFAULT_LED_POINT_SIZE * 0.5);

    let positionIdx = 0;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const currTranslation = new THREE.Vector3(
            x*VoxelConstants.VOXEL_UNIT_SIZE + VoxelConstants.VOXEL_UNIT_SIZE,
            y*VoxelConstants.VOXEL_UNIT_SIZE + VoxelConstants.VOXEL_HALF_UNIT_SIZE,
            z*VoxelConstants.VOXEL_UNIT_SIZE + VoxelConstants.VOXEL_HALF_UNIT_SIZE
          );
          currTranslation.add(worldTranslation);
          
          ledPositions[positionIdx]   = currTranslation.x;
          ledPositions[positionIdx+1] = currTranslation.y;
          ledPositions[positionIdx+2] = currTranslation.z;

          positionIdx += 3;
        }
      }
    }

    this.colourBuffer = new THREE.BufferAttribute(ledColours, 3);

    // Add the LEDs to the scene
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(ledPositions, 3));
    geometry.setAttribute('customColour', this.colourBuffer);
    geometry.setAttribute('size', new THREE.BufferAttribute(ledSizes, 1));

    let material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xffffff) },
        pointTexture: { value: new THREE.TextureLoader().load("../textures/disc.png") }
      },
      vertexShader: POINTS_VERTEX_SHADER,
      fragmentShader: POINTS_FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    const self = this;
    this.leds = new THREE.Points(geometry, material);
    this._scene.add(this.leds);

    // Add wireframe outlines for all the cube boundaries of each LED within the array
    let wfVertices = new Float32Array(Math.pow((this.gridSize + 1),3)*3*3*2);
    let lineTranslation = halfTranslationUnits;
    let idx = 0;
    const voxelUnitSize = VoxelConstants.VOXEL_UNIT_SIZE;
    for (let x = 0; x <= this.gridSize; x++) {
      for (let y = 0; y <= this.gridSize; y++) {
        for (let z = 0; z <= this.gridSize; z++) {
          // Draw a line along the...
          // x-axis
          wfVertices[idx++] = -lineTranslation; wfVertices[idx++] = -lineTranslation + y*voxelUnitSize; wfVertices[idx++] = -lineTranslation + z*voxelUnitSize;
          wfVertices[idx++] = lineTranslation; wfVertices[idx++] = -lineTranslation + y*voxelUnitSize; wfVertices[idx++] = -lineTranslation + z*voxelUnitSize;
          // y-axis
          wfVertices[idx++] = -lineTranslation + x*voxelUnitSize; wfVertices[idx++] = -lineTranslation; wfVertices[idx++] = -lineTranslation + z*voxelUnitSize;
          wfVertices[idx++] = -lineTranslation + x*voxelUnitSize; wfVertices[idx++] = lineTranslation; wfVertices[idx++] = -lineTranslation + z*voxelUnitSize;
          // z-axis
          wfVertices[idx++] = -lineTranslation + x*voxelUnitSize; wfVertices[idx++] = -lineTranslation + y*voxelUnitSize; wfVertices[idx++] = -lineTranslation;
          wfVertices[idx++] = -lineTranslation + x*voxelUnitSize; wfVertices[idx++] = -lineTranslation + y*voxelUnitSize; wfVertices[idx++] = lineTranslation;
        }
      }
    }

    let wireframeGeometry = new THREE.BufferGeometry();
    wireframeGeometry.setAttribute('position', new THREE.BufferAttribute(wfVertices, 3));

    const outlineMaterial = new THREE.LineBasicMaterial({color: 0xffffff});
    outlineMaterial.transparent = true;
    outlineMaterial.opacity = 0.02;

    this.outlines = new THREE.LineSegments(wireframeGeometry, outlineMaterial);
    this.outlines.name = "outlines";
    this.setOutlinesEnabled(this.outlinesEnabled);
    this.setOrbitModeEnabled(this.orbitModeEnabled);
  }

  setOutlinesEnabled(enable) {
    if (this.outlines) {
      if (enable) { this._scene.add(this.outlines); }
      else { this._scene.remove(this.outlines); }
    }
    this.outlinesEnabled = enable;
  }

  setOrbitModeEnabled(enable) {
    this._controls.autoRotate = enable;
    this.orbitModeEnabled = enable;
  }

  // Used to update the entire voxel colour buffer in one shot
  setVoxelBuffer(voxelBuffer) {
    this.colourBuffer.array = voxelBuffer;
    this.colourBuffer.needsUpdate = true;
  } 

}

export default VoxelDisplay;
