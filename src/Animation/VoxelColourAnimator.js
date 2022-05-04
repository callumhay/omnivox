import * as THREE from 'three';
import chroma from 'chroma-js';

import VoxelAnimator from './VoxelAnimator';
import {COLOUR_INTERPOLATION_LRGB} from '../Spectrum';
import VoxelConstants from '../VoxelConstants';
import VoxelGeometryUtils from '../VoxelGeometryUtils';

export const INTERPOLATION_LERP     = 'lerp';
export const INTERPOLATION_SMOOTH   = 'smooth';
export const INTERPOLATION_SMOOTHER = 'smoother';
export const INTERPOLATION_TYPES = [
  INTERPOLATION_LERP,
  INTERPOLATION_SMOOTH,
  INTERPOLATION_SMOOTHER,
];

export const VOXEL_COLOUR_SHAPE_TYPE_ALL    = "All";
export const VOXEL_COLOUR_SHAPE_TYPE_POINT  = "Point";
export const VOXEL_COLOUR_SHAPE_TYPE_SPHERE = "Sphere";
export const VOXEL_COLOUR_SHAPE_TYPE_BOX    = "Box";

export const voxelColourAnimatorDefaultConfig = {
  shapeType: VOXEL_COLOUR_SHAPE_TYPE_ALL,
  pointProperties: {
    point: {x: 0, y: 0, z: 0}
  },
  sphereProperties: { 
    center: { x: VoxelConstants.VOXEL_HALF_GRID_IDX, y: VoxelConstants.VOXEL_HALF_GRID_IDX, z: VoxelConstants.VOXEL_HALF_GRID_IDX }, 
    radius: VoxelConstants.VOXEL_HALF_GRID_IDX, 
    fill: false
  },
  boxProperties: { 
    center: { x: VoxelConstants.VOXEL_HALF_GRID_IDX, y: VoxelConstants.VOXEL_HALF_GRID_IDX, z: VoxelConstants.VOXEL_HALF_GRID_IDX }, 
    rotation: { x: 0, y: 0, z: 0}, 
    size: {x: 2 * VoxelConstants.VOXEL_HALF_GRID_IDX - 2, y: 2 * VoxelConstants.VOXEL_HALF_GRID_IDX - 2, z: 2 * VoxelConstants.VOXEL_HALF_GRID_IDX - 2}, 
    fill: false 
  },
  colourStart: {r:0, g:0, b:0},
  colourEnd: {r:0.5, g:0.5, b:0.5},
  colourInterpolationType: COLOUR_INTERPOLATION_LRGB,
  interpolationType: INTERPOLATION_LERP,
  startTimeSecs: 0.0,
  endTimeSecs: 10.0
};

const _currColour = new THREE.Color();

class VoxelColourAnimator extends VoxelAnimator {
  constructor(voxels, config = voxelColourAnimatorDefaultConfig) {
    super(voxels, config);
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR; }

  load() {
    this.colourStart = new THREE.Color();
    this.colourEnd   = new THREE.Color();
    this.voxelPositions = [];
    this.currTime = 0;
    this.animationFinished = false;
  }
  unload() {
    this.voxelPositions = null;
    this.colourStart = null;
    this.colourEnd = null;
  }

  setConfig(c, init=false) {
    if (!super.setConfig(c, init)) { return; } // Don't load everything on initialization
    
    const {shapeType, pointProperties, sphereProperties, boxProperties, colourStart, colourEnd} = this.config;
    switch (shapeType) {
      case VOXEL_COLOUR_SHAPE_TYPE_ALL:
      default:
        this.voxelPositions = VoxelGeometryUtils.voxelIndexList(VoxelConstants.VOXEL_GRID_SIZE);
        break;

      case VOXEL_COLOUR_SHAPE_TYPE_POINT: {
        const {point} = pointProperties;
        this.voxelPositions = [new THREE.Vector3(point.x, point.y, point.z)];
        break;
      }

      case VOXEL_COLOUR_SHAPE_TYPE_SPHERE: {
        const {center, radius, fill} = sphereProperties;
        const centerVec3 = new THREE.Vector3(center.x, center.y, center.z);
        this.voxelPositions = VoxelGeometryUtils.voxelSphereList(
          centerVec3, radius, fill, VoxelGeometryUtils.voxelBoundingBox(VoxelConstants.VOXEL_GRID_SIZE)
        );
        break;
      }

      case VOXEL_COLOUR_SHAPE_TYPE_BOX: {
        const {center, rotation, size, fill} = boxProperties;
        const centerVec3 = new THREE.Vector3(center.x, center.y, center.z);
        const eulerRot = new THREE.Euler(
          THREE.MathUtils.degToRad(rotation.x), 
          THREE.MathUtils.degToRad(rotation.y),
          THREE.MathUtils.degToRad(rotation.z), 'XYZ'
        );
        const sizeVec3 = new THREE.Vector3(size.x, size.y, size.z);
        this.voxelPositions = VoxelGeometryUtils.voxelBoxList(
          centerVec3, sizeVec3, eulerRot, fill, VoxelGeometryUtils.voxelBoundingBox(VoxelConstants.VOXEL_GRID_SIZE)
        );
        break;
      }
    }

    this.colourStart.copy(colourStart);
    this.colourEnd.copy(colourEnd);
  }

  reset() {
    this.currTime = 0;
    this.animationFinished = false;
  }

  rendersToCPUOnly() { return true; }

  render(dt) {
    const {startTimeSecs, endTimeSecs, colourInterpolationType, interpolationType} = this.config;

    if (this.currTime >= startTimeSecs) {
      let interpolateAlpha = 0;
      switch (interpolationType) {
        default:
        case INTERPOLATION_LERP:
          interpolateAlpha = (this.currTime - startTimeSecs) / (endTimeSecs - startTimeSecs);
          break;
        case INTERPOLATION_SMOOTH:
          interpolateAlpha = THREE.MathUtils.smoothstep(this.currTime, startTimeSecs, endTimeSecs);
          break;
        case INTERPOLATION_SMOOTHER:
          interpolateAlpha = THREE.MathUtils.smootherstep(this.currTime, startTimeSecs, endTimeSecs);
          break;
      }
      
      _currColour.set(chroma.mix(this.colourStart.getHex(), this.colourEnd.getHex(), interpolateAlpha, colourInterpolationType).hex());
      for (const voxelPos of this.voxelPositions) {
        this.voxelModel.drawPoint(voxelPos, _currColour);
      }

      this.animationFinished = (this.currTime >= endTimeSecs);
    }

    this.currTime = Math.min(endTimeSecs, this.currTime + dt); // Clamp to the end time
  }

}

export default VoxelColourAnimator;
