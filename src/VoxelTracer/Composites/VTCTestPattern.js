import * as THREE from 'three';
import chroma from 'chroma-js';

import VTBox from "../VTBox";
import VTEmissionMaterial from '../VTEmissionMaterial';
import VoxelConstants from '../../VoxelConstants';

const TP_TOP_COLOUR_BLOCK_HEIGHT = 12.0;
const HALF_TP_COLOUR_BLOCK_HEIGHT = TP_TOP_COLOUR_BLOCK_HEIGHT / 2.0;
const TP_MID_COLOUR_BLOCK_HEIGHT = 2.0;
const HALF_TP_MID_COLOUR_BLOCK_HEIGHT = TP_MID_COLOUR_BLOCK_HEIGHT / 2.0;

const TEST_PATTERN_BLOCK_COLOURS = [
  "#d3e0e9", // Light Grey
  "#7f7f7f", // Grey
  "#fdff00", // Yellow
  "#02feff", // Cyan
  "#08ff00", // Green
  "#ff00ff", // Magenta
  "#ff0200", // Red
  "#1000ff", // Blue
];

class VTCTestPattern {

  constructor(gridSize) {
    this.gridSize = gridSize;

    this.topColourBlocks    = [];
    this.midColourBlocks    = [];
    this.bottomColourBlocks = [];
  }

  build() {
    const halfGridSize = this.gridSize / 2.0;
    const colourBlockXSize = 2;
    const colourBlockHalfXSize = colourBlockXSize/2;
    const colourBlockZSize = 4; // this.gridSize;

    const colourBlockOptions = {samplesPerVoxel: 1, fill: true, castsShadows: false, receivesShadows: false};
    const currPos = new THREE.Vector3();
    const currSize = new THREE.Vector3();

    const topColourBlockY = this.gridSize-HALF_TP_COLOUR_BLOCK_HEIGHT;
    currSize.set(colourBlockXSize, TP_TOP_COLOUR_BLOCK_HEIGHT, colourBlockZSize);
    this.topColourBlocks = [];
    for (let i = 0; i < halfGridSize; i++) {
      const currColour = new THREE.Color(TEST_PATTERN_BLOCK_COLOURS[i]);
      currPos.set(2*i + colourBlockHalfXSize, topColourBlockY, halfGridSize);
      this.topColourBlocks.push(new VTBox(currPos, currSize, new VTEmissionMaterial(currColour, 1.0), colourBlockOptions));
    }

    const midColourBlockY = topColourBlockY-HALF_TP_COLOUR_BLOCK_HEIGHT-HALF_TP_MID_COLOUR_BLOCK_HEIGHT;
    currSize.set(colourBlockXSize, TP_MID_COLOUR_BLOCK_HEIGHT, colourBlockZSize);
    this.midColourBlocks = [];
    for (let i = 0; i < halfGridSize; i++) {
      const currColour = new THREE.Color((i % 2 === 0) ? "#000" : TEST_PATTERN_BLOCK_COLOURS[halfGridSize-i]);
      currPos.set(2*i + colourBlockHalfXSize, midColourBlockY, halfGridSize);
      this.midColourBlocks.push(new VTBox(currPos, currSize, new VTEmissionMaterial(currColour, 1.0), colourBlockOptions));
    }

    const TP_BOTTOM_COLOUR_BLOCK_HEIGHT = this.gridSize - (TP_TOP_COLOUR_BLOCK_HEIGHT + TP_MID_COLOUR_BLOCK_HEIGHT);
    const HALF_TP_BOTTOM_COLOUR_BLOCK_HEIGHT = TP_BOTTOM_COLOUR_BLOCK_HEIGHT / 2.0;

    const bottomColourBlockY = midColourBlockY-HALF_TP_MID_COLOUR_BLOCK_HEIGHT-HALF_TP_BOTTOM_COLOUR_BLOCK_HEIGHT;
    currSize.set(colourBlockXSize, TP_BOTTOM_COLOUR_BLOCK_HEIGHT, colourBlockZSize);
    this.bottomColourBlocks = [];
    for (let i = 0; i < halfGridSize; i++) {
      const currColour = new THREE.Color(chroma.mix('white', 'black', i/(halfGridSize-1), 'rgb').hex());
      currPos.set(2*i + colourBlockHalfXSize, bottomColourBlockY, halfGridSize);
      this.bottomColourBlocks.push(new VTBox(currPos, currSize, new VTEmissionMaterial(currColour, 1.0), colourBlockOptions));
    }
  }

  addToScene(scene) { this._applySceneFuncToAll(scene, 'addObject'); }
  removeFromScene(scene) { this._applySceneFuncToAll(scene, 'removeObject'); }

  _applySceneFuncToAll(scene, func) {
    for (const colourBlk of this.topColourBlocks)    { scene[func](colourBlk); }
    for (const colourBlk of this.midColourBlocks)    { scene[func](colourBlk); }
    for (const colourBlk of this.bottomColourBlocks) { scene[func](colourBlk); }
  }

  setAlpha(a) {
    for (const colourBlk of this.topColourBlocks)    { colourBlk.material.alpha = a; colourBlk.makeDirty(); }
    for (const colourBlk of this.midColourBlocks)    { colourBlk.material.alpha = a; colourBlk.makeDirty(); }
    for (const colourBlk of this.bottomColourBlocks) { colourBlk.material.alpha = a; colourBlk.makeDirty(); }
  }

}

export default VTCTestPattern;
