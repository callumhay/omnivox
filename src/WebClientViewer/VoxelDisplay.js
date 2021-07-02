import * as THREE from 'three';

import VoxelConstants from '../VoxelConstants';

const DEFAULT_LED_POINT_SIZE = VoxelConstants.VOXEL_UNIT_SIZE * 1.33;

const POINTS_VERTEX_SHADER = `
  attribute float size;
  attribute vec3 customColour;

  varying vec3 vColor;

  void main() {
    vColor = customColour;
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
    gl_FragColor = vec4(color * vColor, 1);
    gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
    if (gl_FragColor.a < 0.5 || (gl_FragColor.r+gl_FragColor.g+gl_FragColor.b) < 0.01 ) { discard; }
  }
`;

class VoxelDisplay {
  constructor(scene, controls) {
    this.voxels = [];
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
    this.voxels = [];
  }

  rebuild(gridSize) {

    // Clean up any previous voxel grid
    this.removeVoxels();

    const halfTranslationUnits = (gridSize*VoxelConstants.VOXEL_UNIT_SIZE)/2.0;
    const worldTranslation = new THREE.Vector3(-halfTranslationUnits, -halfTranslationUnits, -halfTranslationUnits);

    this.gridSize = gridSize;
    const numLEDs = this.gridSize*this.gridSize*this.gridSize;

    let ledPositions = new Float32Array(numLEDs*3);
    let ledColours   = new Float32Array(numLEDs*3).fill(1);
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
      alphaTest: 0.5,
      //opacity: 0.75,
      //transparent: true,
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

    for (let x = 0; x < this.gridSize; x++) {
      let currXArr = [];
      this.voxels.push(currXArr);
      for (let y = 0; y < this.gridSize; y++) {
        let currYArr = [];
        currXArr.push(currYArr);
        for (let z = 0; z < this.gridSize; z++) {

          const currVoxelObj = {
            getColourIndex: function() {
              return (x*self.gridSize*self.gridSize + y*self.gridSize + z)*3;
            },
            getColour: function() {
              const startIdx = this.getColourIndex();
              const colourArray = self.colourBuffer.array;
              return THREE.Color(colourArray[startIdx], colourArray[startIdx+1], colourArray[startIdx+2]);
            },
            setColourRGB: function(r, g, b) {
              const startIdx = this.getColourIndex();
              self.colourBuffer.set([r, g, b], startIdx);
              self.colourBuffer.needsUpdate = true;
            },
            setColour: function(colour) { 
              const startIdx = this.getColourIndex();
              self.colourBuffer.set([colour.r, colour.g, colour.b], startIdx);
              self.colourBuffer.needsUpdate = true;
            },
          };

          currYArr.push(currVoxelObj);
        }
      }
    }
  }

  setOutlinesEnabled(enable) {
    if (this.outlines) {
      if (enable) {
        this._scene.add(this.outlines);
      }
      else {
        this._scene.remove(this.outlines);
      }
    }
    this.outlinesEnabled = enable;
  }
  setOrbitModeEnabled(enable) {
    this._controls.autoRotate = enable;

    this.orbitModeEnabled = enable;
  }

  xSize() { return this.voxels.length; }
  ySize() { return this.voxels[0].length; }
  zSize() { return this.voxels[0][0].length; }

  /**
   * Build a flat list of all of the possible voxel indices (x,y,z) in this display
   * as a list of THREE.Vector3 objects.
   */
  voxelIndexList() {
    const idxList = [];
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          idxList.push(new THREE.Vector3(x,y,z));
        }
      }
    }
    return idxList;
  }

  setVoxelXYZRGB(x,y,z,r,g,b) {
    const roundedX = Math.floor(x);
    const roundedY = Math.floor(y);
    const roundedZ = Math.floor(z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      this.voxels[roundedX][roundedY][roundedZ].setColourRGB(r, g, b);
    } 
  }

  clearRGB(r=0, g=0, b=0) {
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          this.voxels[x][y][z].setColourRGB(r,g,b);
        }
      }
    }
  }
  clear(colour) {
    this.clearRGB(colour.r, colour.g, colour.b);
  }
}

export default VoxelDisplay;