import * as THREE from 'three';

import {clamp} from '../MathUtils';
import VoxelConstants from '../VoxelConstants';

import VoxelAnimator, {DEFAULT_CROSSFADE_TIME_SECS} from '../Animation/VoxelAnimator';
import VoxelColourAnimator from '../Animation/VoxelColourAnimator';
import TextAnimator from '../Animation/TextAnimator';
import StarShowerAnimator from '../Animation/StarShowerAnimator';
import ShapeWaveAnimator from '../Animation/ShapeWaveAnimator';
import FireAnimator from '../Animation/FireAnimator';
import SceneAnimator from '../Animation/SceneAnimator';
import BarVisualizerAnimator from '../Animation/BarVisualizerAnimator';
import WaterAnimator from '../Animation/WaterAnimator';

import VTScene from '../VoxelTracer/VTScene';
import VoxelFramebufferCPU from './VoxelFramebufferCPU';
import VoxelFramebufferGPU from './VoxelFramebufferGPU';
import GPUKernelManager from './GPUKernelManager';


export const BLEND_MODE_OVERWRITE = 0;
export const BLEND_MODE_ADDITIVE  = 1;

const DEFAULT_POLLING_FREQUENCY_HZ = 60; // Render Frames per second - if this is too high then we overwhelm our clients
const DEFAULT_POLLING_INTERVAL_MS  = 1000 / DEFAULT_POLLING_FREQUENCY_HZ;

class VoxelModel {

  // Framebuffer index constants
  static get GPU_FRAMEBUFFER_IDX_0() { return 0; }
  static get GPU_FRAMEBUFFER_IDX_1() { return 1; }
  static get CPU_FRAMEBUFFER_IDX_0() { return 2; }
  static get CPU_FRAMEBUFFER_IDX_1() { return 3; }

  static getOtherFramebufferIndex(idx) {
    switch (idx) {
      case VoxelModel.GPU_FRAMEBUFFER_IDX_0: return VoxelModel.GPU_FRAMEBUFFER_IDX_1;
      case VoxelModel.GPU_FRAMEBUFFER_IDX_1: return VoxelModel.GPU_FRAMEBUFFER_IDX_0;
      case VoxelModel.CPU_FRAMEBUFFER_IDX_0: return VoxelModel.CPU_FRAMEBUFFER_IDX_1;
      case VoxelModel.CPU_FRAMEBUFFER_IDX_1: return VoxelModel.CPU_FRAMEBUFFER_IDX_0;
      default:
        console.log("Invalid framebuffer index.");
        break;
    }
    return null;
  }

  // Framebuffer combination constants
  static get FB1_ALPHA_FB2_ONE_MINUS_ALPHA() { return 0; }

  constructor(gridSize) {

    this.gridSize = gridSize;
    this.blendMode = BLEND_MODE_OVERWRITE;
    this.gpuKernelMgr = new GPUKernelManager(gridSize);

    // Note: Indices MUST match up with the constants for *_FRAMEBUFFER_IDX_* !!!!
    this._framebuffers = [
      new VoxelFramebufferGPU(0, this.gpuKernelMgr),
      new VoxelFramebufferGPU(1, this.gpuKernelMgr),
      new VoxelFramebufferCPU(2, gridSize, this.gpuKernelMgr),
      new VoxelFramebufferCPU(3, gridSize, this.gpuKernelMgr),
    ];
    this._framebufferIdx = VoxelModel.GPU_FRAMEBUFFER_IDX_0;

    // Build a voxel tracer scene, which will be shared by all animators that use it
    this.vtScene = new VTScene(this);
    this._animators = {
      [VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR]       : new VoxelColourAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TEXT]              : new TextAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER]  : new StarShowerAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES]  : new ShapeWaveAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_FIRE]              : new FireAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_WATER]             : new WaterAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_SCENE]             : new SceneAnimator(this, this.vtScene),
      [VoxelAnimator.VOXEL_ANIM_BAR_VISUALIZER]    : new BarVisualizerAnimator(this),
    };

    this.currentAnimator = this._animators[VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR];

    this.currFrameTime = Date.now();
    this.frameCounter = 0;

    // Crossfading
    this.totalCrossfadeTime = DEFAULT_CROSSFADE_TIME_SECS;
    this.crossfadeCounter = Infinity;
    this.prevAnimator = null;
  }

  xSize() { return this.gridSize; }
  ySize() { return this.gridSize; }
  zSize() { return this.gridSize; }
  numVoxels() { return this.xSize()*this.ySize()*this.zSize(); }

  setFramebuffer(idx=0) { this._framebufferIdx = idx; }
  get framebuffer() {
    return this._framebuffers[this._framebufferIdx];
  }

  debugPrintVoxelTexture(isCPU) {
    const arr = this.framebuffer.getCPUBuffer();
    //console.log(arr);

    const strArr = [];
    for (let x = 0; x < this.xSize(); x++) {
      for (let y = 0; y < this.ySize(); y++) {
        const temp = [];
        for (let z = 0; z < this.zSize(); z++) {
          const currColour = arr[x][y][z];
          temp.push("("+currColour[0].toFixed(0)+","+currColour[1].toFixed(0)+","+currColour[2].toFixed(0)+")")
        }
        strArr.push(temp.join(", "));
      }
    }
    console.log(strArr.join("\n"));
  }

  setAnimator(type, config) {
    if (!(type in this._animators)) {
      return false;
    }

    // Check to see if we're changing animators
    const nextAnimator = this._animators[type];
    if (this.currentAnimator !== nextAnimator) {
      this.prevAnimator = this.currentAnimator;
      this.currentAnimator = nextAnimator;
      this.crossfadeCounter = 0;
    }

    if (config) {
      this.currentAnimator.setConfig(config);
    }

    return true;
  }

  setCrossfadeTime(t) {
    this.totalCrossfadeTime = Math.max(0, t);
    this._animators[VoxelAnimator.VOXEL_ANIM_SCENE].setCrossfadeTime(this.totalCrossfadeTime);
  }

  run(voxelServer) {
    let self = this;
    let lastFrameTime = Date.now();
    let dt = 0;
    let framesOnQueue = 0;

    const renderLoop = async function() {
      self.currFrameTime = Date.now();
      dt = (self.currFrameTime - lastFrameTime) / 1000;

      // Simulate the model based on the current animation...
      this.blendMode = BLEND_MODE_OVERWRITE;

      // Deal with crossfading between animators
      if (self.prevAnimator) {
        // Adjust the animator alphas as a percentage of the crossfade time and continue counting the total time until the crossfade is complete
        const percentFade = clamp(self.crossfadeCounter / self.totalCrossfadeTime, 0, 1);
        const prevAnimator = self.prevAnimator;

        if (self.crossfadeCounter < self.totalCrossfadeTime) {
          self.crossfadeCounter += dt;
        }
        else {
          // no longer crossfading, reset to just showing the current scene
          self.crossfadeCounter = Infinity;
          self.prevAnimator.stop();
          self.prevAnimator = null;
        }

        // Blend the currentAnimtor with the previous one via framebuffer - we need to do this so that we
        // aren't just overwriting the voxel framebuffer despite the crossfade amounts for each animation
        const prevAnimatorFBIdx = prevAnimator.rendersToCPUOnly() ? VoxelModel.CPU_FRAMEBUFFER_IDX_0 : VoxelModel.GPU_FRAMEBUFFER_IDX_0;
        self.setFramebuffer(prevAnimatorFBIdx);
        self.clear();
        await prevAnimator.render(dt);

        const currAnimatorFBIdx = self.currentAnimator.rendersToCPUOnly() ? VoxelModel.CPU_FRAMEBUFFER_IDX_1 : VoxelModel.GPU_FRAMEBUFFER_IDX_1;
        self.setFramebuffer(currAnimatorFBIdx);
        self.clear();
        await self.currentAnimator.render(dt);

        self.setFramebuffer(VoxelModel.GPU_FRAMEBUFFER_IDX_0);
        self.drawCombinedFramebuffers(currAnimatorFBIdx, prevAnimatorFBIdx, {mode: VoxelModel.FB1_ALPHA_FB2_ONE_MINUS_ALPHA, alpha: percentFade});
      }
      else {
        // No crossfade, just render the current animation
        const currFBIdx = self.currentAnimator.rendersToCPUOnly() ? VoxelModel.CPU_FRAMEBUFFER_IDX_0 : VoxelModel.GPU_FRAMEBUFFER_IDX_0;
        self.setFramebuffer(currFBIdx);
        self.clear();
        await self.currentAnimator.render(dt);
      }

      // Let the server know to broadcast the new voxel data to all clients
      voxelServer.setVoxelData(self.framebuffer.getCPUBuffer(), self.frameCounter);
      self.frameCounter++;

      lastFrameTime = self.currFrameTime;

      // Make sure we're keeping up with the set framerate, accounting for the time it took to execute the current frame
      framesOnQueue--;
      if (framesOnQueue === 0) {
        const currTotalFrameTime = Date.now() - self.currFrameTime;
        const timeToNextFrame = DEFAULT_POLLING_INTERVAL_MS-currTotalFrameTime;
        if (timeToNextFrame <= 0) {
          setImmediate(renderLoop);
        }
        else {
          setTimeout(renderLoop, timeToNextFrame);
        }
        framesOnQueue++;
      }
    };

    setTimeout(renderLoop, DEFAULT_POLLING_INTERVAL_MS);
    framesOnQueue = 1;
  }
 
  /**
   * Check whether the given point is in the local space bounds of the voxels.
   * @param {THREE.Vector3} pt 
   */
  isInBounds(pt) {
    const adjustedX = Math.floor(pt.x);
    const adjustedY = Math.floor(pt.y);
    const adjustedZ = Math.floor(pt.z);
    return adjustedX >= 0 && adjustedX < this.xSize() && adjustedY >= 0 && adjustedY < this.ySize() && adjustedZ >= 0 && adjustedZ < this.zSize();
  }

  /**
   * Get the local space Axis-Aligned Bounding Box for all voxels.
   */
  getBoundingBox() {
    return VoxelModel.voxelBoundingBox(this.xSize(), this.ySize(), this.zSize());
  }
  static voxelBoundingBox(xSize, ySize, zSize) {
    return new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(xSize-1, ySize-1, zSize-1));
  }
  
  setVoxel(pt=new THREE.Vector3(0,0,0), colour=new THREE.Color(0,0,0))   {
    this.framebuffer.setVoxel([pt.x, pt.y, pt.z], [colour.r, colour.g, colour.b]);
  }
  addToVoxel(pt=new THREE.Vector3(0,0,0), colour=new THREE.Color(0,0,0)) {
    this.framebuffer.addToVoxel([pt.x, pt.y, pt.z], [colour.r, colour.g, colour.b]);
  }
  addToVoxelFast(pt, colour) {
    this.framebuffer.addToVoxelFast([pt.x, pt.y, pt.z], [colour.r, colour.g, colour.b]);
  }

  static voxelIdStr(voxelPt) {
    return voxelPt.x.toFixed(0) + "_" + voxelPt.y.toFixed(0) + "_" + voxelPt.z.toFixed(0);
  }
  static voxelFlatIdx(voxelPt, gridSize) {
    return voxelPt.x*gridSize*gridSize + voxelPt.y*gridSize + voxelPt.z;
  }

  static calcVoxelBoundingBox(voxelPt) {
    const adjustedX = Math.floor(voxelPt.x);
    const adjustedY = Math.floor(voxelPt.y);
    const adjustedZ = Math.floor(voxelPt.z);

    return new THREE.Box3(
      new THREE.Vector3(adjustedX, adjustedY, adjustedZ), 
      new THREE.Vector3(adjustedX + VoxelConstants.VOXEL_UNIT_SIZE, adjustedY + VoxelConstants.VOXEL_UNIT_SIZE, adjustedZ + VoxelConstants.VOXEL_UNIT_SIZE)
    );
  }

  static closestVoxelIdxPt(pt) {
    return new THREE.Vector3(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z));
  }

  drawFramebuffer(idx) {
    if (idx === this._framebufferIdx) {
      console.error("Attempting to draw a framebuffer into itself, ignoring.");
      return;
    }

    this.framebuffer.drawFramebuffer(this._framebuffers[idx], this.blendMode);
  }

  drawCombinedFramebuffers(fb1Idx, fb2Idx, options) {
    this.framebuffer.drawCombinedFramebuffers(this._framebuffers[fb1Idx], this._framebuffers[fb2Idx], options);
  }

  clear(colour=new THREE.Color(0,0,0)) {
    this.framebuffer.clear([colour.r, colour.g, colour.b]);
  }

  clearAll(colour=new THREE.Color(0,0,0)) {
    const colourArr = [colour.r, colour.g, colour.b];
    for (let i = 0; i < this._framebuffers.length; i++) {
      this._framebuffers[i].clear(colourArr);
    }
  }

  drawPoint(pt=new THREE.Vector3(0,0,0), colour=new THREE.Color(1,1,1)) {
    this.framebuffer.drawPoint([pt.x, pt.y, pt.z], [colour.r, colour.g, colour.b], this.blendMode);
  }

  drawBox(minPt=new THREE.Vector3(0,0,0), maxPt=new THREE.Vector3(1,1,1), colour=new THREE.Color(1,1,1), fill=false) {
    this.framebuffer.drawBox(minPt, maxPt, colour, fill, this.blendMode);
  }

  drawSphere(center=new THREE.Vector3(0,0,0), radius=1, colour=new THREE.Color(1,1,1), fill=false) {
    this.framebuffer.drawSphere(center, radius, colour, fill, this.blendMode);
  }
  drawSpheres(center=[0,0,0], radii, colours, brightness) {
    this.framebuffer.drawSpheres(center, radii, colours, brightness);
  }
  drawCubes(center=[0,0,0], radii, colours, brightness) {
    this.framebuffer.drawCubes(center, radii, colours, brightness);
  }

  static voxelSphereList(center, radius, fill, voxelBoundingBox) {
    // Create a bounding box for the sphere: 
    // Centered at the given center with a half width/height/depth of the given radius
    const sphereBounds = new THREE.Sphere(center, radius);
    const sphereBoundingBox = new THREE.Box3(center.clone().subScalar(radius).floor().max(voxelBoundingBox.min), center.clone().addScalar(radius).ceil().min(voxelBoundingBox.max));

    // Now we go through all the voxels in the bounding box and build a point list
    const voxelPts = [];
    for (let x = sphereBoundingBox.min.x; x <= sphereBoundingBox.max.x; x++) {
      for (let y = sphereBoundingBox.min.y; y <= sphereBoundingBox.max.y; y++) {
        for (let z = sphereBoundingBox.min.z; z <= sphereBoundingBox.max.z; z++) {

          // Check whether the current voxel is inside the voxel grid and inside the radius of the sphere
          const currPt = new THREE.Vector3(x,y,z);
          const distToCurrPt = sphereBounds.distanceToPoint(currPt);
          if (fill) {
            if (distToCurrPt < VoxelConstants.VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
          else {
            if (Math.abs(distToCurrPt) < VoxelConstants.VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }

        }

      }
    }
    return voxelPts;
  }

  static voxelBoxList(minPt, maxPt, fill, voxelBoundingBox) {
    
    const voxelPts = [];
    const mappedMinPt = minPt.clone().floor();
    mappedMinPt.max(voxelBoundingBox.min);
    const mappedMaxPt = maxPt.clone().ceil();
    mappedMaxPt.min(voxelBoundingBox.max);

    if (fill) {
      for (let x = mappedMinPt.x; x <= mappedMaxPt.x; x++) {
        for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }
    else {
      // Not filling the box... just go around the outside of it
      let incX = Math.floor(mappedMaxPt.x-mappedMinPt.x);
      if (incX <= 0) {
        incX = mappedMaxPt.x-mappedMinPt.x;
      }

      for (let x = mappedMinPt.x; x <= mappedMaxPt.x; x += incX) {
        for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incY = Math.floor(mappedMaxPt.y-mappedMinPt.y);
      if (incY <= 0) {
        incY = mappedMaxPt.y-mappedMinPt.y;
      }

      for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y += incY) {
        for (let x = mappedMinPt.x+1; x < mappedMaxPt.x; x++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incZ = Math.floor(mappedMaxPt.z-mappedMinPt.z);
      if (incZ <= 0) {
        incZ = mappedMaxPt.z-mappedMinPt.z;
      }

      for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z += incZ) {
        for (let x = mappedMinPt.x+1; x < mappedMaxPt.x; x++) {
          for (let y = mappedMinPt.y+1; y < mappedMaxPt.y; y++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }
    return voxelPts;
  }

}

export default VoxelModel;