import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import {VOXEL_EPSILON} from '../MathUtils';

export const WAVE_SHAPE_CUBE   = 'cube';
export const WAVE_SHAPE_SPHERE = 'sphere';
export const WAVE_SHAPE_TYPES = [
  WAVE_SHAPE_CUBE,
  WAVE_SHAPE_SPHERE,
];

export const shapeWaveAnimatorDefaultConfig = {
  waveShape: WAVE_SHAPE_SPHERE,
  center: {x: 3.5, y: 3.5, z: 3.5},
  waveSpeed: 3, // units / second
  waveGap: 1, // space between waves
  colourPalette: [new THREE.Color(0xff0000), new THREE.Color(0x00ff00), new THREE.Color(0x0000ff)],

  repeat: -1, // This needs to be here for the VoxelAnimator setConfig
};

class WaveShape {
  constructor(voxelDisplay, center, shape, colour) {
    this.voxelDisplay = voxelDisplay;
    this.center = new THREE.Vector3(center.x, center.y, center.z);
    this.shape  = shape;
    this.colour = colour;

    this.minSampleUnitsBeforeRedraw = () => (this.voxelDisplay.voxelSizeInUnits() / 3);

    this.radius = 0;
    this.lastDrawRadius = 0;
    this.animationFinished = false;
  }

  drawVoxels(drawRadius) {
    switch (this.shape) {
      case WAVE_SHAPE_CUBE:
        const minPt = this.getMinPt(drawRadius);
        const maxPt = this.getMaxPt(drawRadius);
        this.voxelDisplay.drawBox(minPt, maxPt, this.colour, false);
        break;
      case WAVE_SHAPE_SPHERE:
        this.voxelDisplay.drawSphere(this.center, drawRadius, this.colour, false);
        break;

      default:
        break;
    }
  }

  getMinPt(r) {
    return this.center.clone().subScalar(r);
  }
  getMaxPt(r) {
    return this.center.clone().addScalar(r);
  }
  isInsideVoxelDisplay() {
    const voxelGridSize = this.voxelDisplay.voxelGridSizeInUnits() + VOXEL_EPSILON;
    const minBoundsPt = new THREE.Vector3(-VOXEL_EPSILON,-VOXEL_EPSILON,-VOXEL_EPSILON);
    const maxBoundsPt = new THREE.Vector3(voxelGridSize, voxelGridSize, voxelGridSize);

    switch (this.shape) {
      case WAVE_SHAPE_CUBE:
        const boundingBox = new THREE.Box3(this.getMinPt(this.radius), this.getMaxPt(this.radius));
        return !boundingBox.containsBox(new THREE.Box3(minBoundsPt, maxBoundsPt));
      case WAVE_SHAPE_SPHERE:
        const boundingSphere = new THREE.Sphere(this.center, this.radius + VOXEL_EPSILON);
        return !(boundingSphere.containsPoint(minBoundsPt) && boundingSphere.containsPoint(maxBoundsPt));
      default:
        return false;
    }
  }

  animate(dt, waveSpeed) {
    if (this.animationFinished) {
      return;
    }

    const redrawSampleUnits = this.minSampleUnitsBeforeRedraw();

    while (this.radius - this.lastDrawRadius >= redrawSampleUnits) {
      const currDrawRadius = this.lastDrawRadius + redrawSampleUnits;
      this.drawVoxels(currDrawRadius);
      this.lastDrawRadius = currDrawRadius;
    }

    this.radius += dt*waveSpeed;

    if (!this.isInsideVoxelDisplay()) {
      this.animationFinished = true;
      // Draw the last spheres before going outside of the display...

      // Find the largest radius from the center of this wave to the outside of the voxel grid
      const voxelGridSize = this.voxelDisplay.voxelGridSizeInUnits() + VOXEL_EPSILON;
      const maxVoxelSpacePt = new THREE.Vector3(voxelGridSize,voxelGridSize,voxelGridSize);

      const distMinVec = new THREE.Vector3(Math.abs(this.center.x), Math.abs(this.center.y), Math.abs(this.center.z)); // since the min point is (0,0,0) just use the absolute value of the center
      const distMaxVec = new THREE.Vector3().subVectors(maxVoxelSpacePt, this.center);
      distMaxVec.set(Math.abs(distMaxVec.x), Math.abs(distMaxVec.y), Math.abs(distMaxVec.z));
      distMaxVec.max(distMinVec);

      const maxRadius = distMaxVec.length() + VOXEL_EPSILON;
      while (this.lastDrawRadius <= maxRadius) {
        const currDrawRadius = this.lastDrawRadius + redrawSampleUnits;
        this.drawVoxels(currDrawRadius);
        this.lastDrawRadius = currDrawRadius;
      }
    }
  }
};

class ShapeWaveAnimator extends VoxelAnimator {
  constructor(voxels, config = shapeWaveAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();

    let colourCounter = 0;
    const getColourCounter = () => (colourCounter);
    const incrementColourCounter = () => {colourCounter++;};

    this.buildWaveShapeAnimator = () => {
      const {center, waveShape, colourPalette} = this.config;
  
      const currColour = colourPalette[getColourCounter() % colourPalette.length];
      incrementColourCounter();
  
      return new WaveShape(voxels, center, waveShape, currColour);
    };
  }

  setConfig(c) {
    super.setConfig(c);
  }

  animate(dt) {
    const {waveSpeed, waveGap} = this.config;

    const voxelSampleSize = this.voxels.voxelSizeInUnits() * (1 + waveGap);
    const lastShape = this.activeShapes.length > 0 ? this.activeShapes[this.activeShapes.length-1] : null;
    if (!lastShape || lastShape.radius >= voxelSampleSize) {
      this.activeShapes.push(this.buildWaveShapeAnimator());
    }
    
    // Tick/draw each of the animators
    this.activeShapes.forEach((waveShape) => {
      waveShape.animate(dt, waveSpeed);
    });

    // Clean up animators that are no longer visible
    this.activeShapes = this.activeShapes.filter((waveShape) => !waveShape.animationFinished);
  }

  reset() {
    super.reset();
    this.activeShapes = [];
  }
}

export default ShapeWaveAnimator;