import * as THREE from 'three';
import {VOXEL_ERR_UNITS, clamp} from '../MathUtils';

import VoxelAnimator, {DEFAULT_CROSSFADE_TIME_SECS} from '../Animation/VoxelAnimator';
import VoxelColourAnimator from '../Animation/VoxelColourAnimator';
import StarShowerAnimator from '../Animation/StarShowerAnimator';
import ShapeWaveAnimator from '../Animation/ShapeWaveAnimator';
import GameOfLifeAnimator from '../Animation/GameOfLifeAnimator';
import FireAnimator from '../Animation/FireAnimator';
import SceneAnimator from '../Animation/SceneAnimator';
import AudioVisualizerAnimator from '../Animation/AudioVisualizerAnimator';

import VTScene from '../VoxelTracer/VTScene';
//import VTSceneMultithreading from '../VoxelTracer/Thread/VTSceneMultithreading'; // Too much work and overhead... not worth it?

export const HALF_VOXEL_SIZE = 0.5;

export const BLEND_MODE_OVERWRITE = 0;
export const BLEND_MODE_ADDITIVE  = 1;

const DEFAULT_POLLING_FREQUENCY_HZ = 60; // Render Frames per second - if this is too high then we overwhelm our clients
const DEFAULT_POLLING_INTERVAL_MS  = 1000 / DEFAULT_POLLING_FREQUENCY_HZ;

class VoxelObject {
  constructor(colour) {
    this.colour = colour;
  }

  setColourRGB(r,g,b) { 
    this.colour.setRGB(r,g,b); 
  }
  setColour(colour) { 
    this.colour.setRGB(colour.r, colour.g, colour.b);
  }
  addColour(colour) { 
    this.colour.add(colour); 
    this.colour.setRGB(clamp(this.colour.r, 0, 1), clamp(this.colour.g, 0, 1), clamp(this.colour.b, 0, 1));
  }
}

class VoxelModel {

  constructor(gridSize) {

    this.gridSize = gridSize;
    this.blendMode = BLEND_MODE_OVERWRITE;
    
    // Build the 3D array of voxels and an extra framebuffer
    const voxelFramebuffer0 = [];
    const voxelFramebuffer1 = [];
    for (let x = 0; x < gridSize; x++) {
      let currXArr = [];
      voxelFramebuffer0.push(currXArr);

      let currFBXArr = [];
      voxelFramebuffer1.push(currFBXArr);

      for (let y = 0; y < gridSize; y++) {
        let currYArr = [];
        currXArr.push(currYArr);

        let currFBYArr = [];
        currFBXArr.push(currFBYArr);

        for (let z = 0; z < gridSize; z++) {
          currYArr.push(new VoxelObject(new THREE.Color(0,0,0)));
          currFBYArr.push(new VoxelObject(new THREE.Color(0,0,0)));
        }
      }
    }

    this.voxelFramebuffers = [voxelFramebuffer0, voxelFramebuffer1];
    this.voxels = voxelFramebuffer0;

    // Build a voxel tracer scene, which will be shared by all animators that use it
    this.vtScene = new VTScene(this); //new VTSceneMultithreading(this);
    this._clearColour = new THREE.Color(0,0,0);
    this._animators = {
      [VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR]       : new VoxelColourAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER]  : new StarShowerAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES]  : new ShapeWaveAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE] : new GameOfLifeAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_FIRE]              : new FireAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_SCENE]             : new SceneAnimator(this, this.vtScene),
      [VoxelAnimator.VOXEL_ANIM_SOUND_VIZ]         : new AudioVisualizerAnimator(this, this.vtScene),
    };

    this.currentAnimator = this._animators[VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR];

    this.currFrameTime = Date.now();
    this.frameCounter = 0;

    // Crossfading
    this.totalCrossfadeTime = DEFAULT_CROSSFADE_TIME_SECS;
    this.crossfadeCounter = Infinity;
    this.prevAnimator = null;
  }

  xSize() {
    return this.voxels.length;
  }
  ySize() {
    return this.voxels[0].length;
  }
  zSize() {
    return this.voxels[0][0].length;
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
    let dtSinceLastRender = 0;
    let skipFrameNumber = 1;
    let catchupTimeInSecs = 0;
    const allowableEventLoopBackupSize = 2;
    const allowablePollingMsBackupSize = allowableEventLoopBackupSize * DEFAULT_POLLING_INTERVAL_MS;
    const allowablePollingSecBackupSize = allowablePollingMsBackupSize / 1000;

    console.log("Allowable max render time per frame set to " + allowablePollingMsBackupSize.toFixed(2) + "ms");

    setInterval(function() {
      self.currFrameTime = Date.now();
      dt = (self.currFrameTime - lastFrameTime) / 1000;
      dtSinceLastRender += dt;

      // If we need to catchup with the interval timer then we need to keep track of
      // how long it's been and skip rendering until we've caught up
      if (catchupTimeInSecs > 0) {
        catchupTimeInSecs = Math.max(0, catchupTimeInSecs - dt);
      }
      else {
        catchupTimeInSecs = Math.max(0, dt - allowablePollingSecBackupSize);
      }
      
      if (catchupTimeInSecs <= 0) {
        self.setFrameBuffer(0);
        self.clear(self._clearColour);

        // Simulate the model based on the current animation...
        
        // Deal with crossfading between animators
        if (self.prevAnimator) {
          // Adjust the animator alphas as a percentage of the crossfade time and continue counting the total time until the crossfade is complete
          const percentFade = clamp(self.crossfadeCounter / self.totalCrossfadeTime, 0, 1);
          const prevAnimator = self.prevAnimator;

          if (self.crossfadeCounter < self.totalCrossfadeTime) {
            self.crossfadeCounter += dtSinceLastRender;
          }
          else {
            // no longer crossfading, reset to just showing the current scene
            self.crossfadeCounter = Infinity;
            self.prevAnimator.stop();
            self.prevAnimator = null;
          }
          // Blend the "currentAnimtor" with the previous one via framebuffer - we need to do this so that we
          // aren't just overwriting the voxel framebuffer despite the crossfade amounts for each animation
          prevAnimator.render(dtSinceLastRender);
          self.multiply(1-percentFade);

          self.setFrameBuffer(1);
          self.clear(self._clearColour);
          self.currentAnimator.render(dtSinceLastRender);
          self.multiply(percentFade);

          self.setFrameBuffer(0);
          self.blendMode = BLEND_MODE_ADDITIVE;
          self.drawFramebuffer(1);
          self.blendMode = BLEND_MODE_OVERWRITE;
        }
        else {
          // No crossfade, just render the current animation
          self.currentAnimator.render(dtSinceLastRender);
        }

        dtSinceLastRender = 0;
        skipFrameNumber = 1;

        // Let the server know to broadcast the new voxel data to all clients
        voxelServer.setVoxelData(self.voxels, self.frameCounter);
        self.frameCounter++;
      }
      else {
        console.log("Skipping Frame: " + self.frameCounter + " (+" + skipFrameNumber + "), catch-up required: " + (catchupTimeInSecs*1000).toFixed(0) + "ms");
        skipFrameNumber++;
      }

      lastFrameTime = self.currFrameTime;
      
    }, DEFAULT_POLLING_INTERVAL_MS);
  }

  setFrameBuffer(idx=0) {
    this.voxels = this.voxelFramebuffers[idx];
  }

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

  /**
   * Check whether the given point is in the local space bounds of the voxels.
   * @param {THREE.Vector3} pt 
   */
  isInBounds(pt) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    return roundedX >= 0 && roundedX < this.voxels.length &&
      roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
      roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length;
  }

  /**
   * Get the local space Axis-Aligned Bounding Box for all voxels.
   */
  getBoundingBox() {
    return new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(this.xSize(), this.ySize(), this.zSize()));
  }
  
  setVoxel(pt, colour) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      this.voxels[roundedX][roundedY][roundedZ].setColour(colour);
    } 
  }
  getVoxel(pt) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    return (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) ?
        this.voxels[roundedX][roundedY][roundedZ] : null;
  }

  addToVoxel(pt, colour) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      const voxel = this.voxels[roundedX][roundedY][roundedZ];
      voxel.addColour(colour);
    } 
  }

  clear(colour) {
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          this.voxels[x][y][z].setColour(colour);
        }
      }
    }
  }
  clearAllFramebuffers(colour) {
    const prevFramebuffer = this.voxels;
    for (let i = 0; i < this.voxelFramebuffers.length; i++) {
      this.setFrameBuffer(i);
      this.clear(colour);
    }
    this.voxels = prevFramebuffer;
  }

  multiply(alpha) {
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          this.voxels[x][y][z].colour.multiplyScalar(alpha);
        }
      }
    }
  }

  voxelColour(pt) {
    return this.getVoxel(pt).colour;
  }

  static voxelIdStr(voxelPt) {
    return voxelPt.x.toFixed(0) + "_" + voxelPt.y.toFixed(0) + "_" + voxelPt.z.toFixed(0);
  }

  mapVoxelXYZToIdx(voxelPt) {
    return voxelPt.x*this.ySize()*this.zSize() + voxelPt.y*this.zSize() + voxelPt.z;
  }

  static calcVoxelBoundingBox(voxelPt) {
    const roundedX = Math.floor(voxelPt.x);
    const roundedY = Math.floor(voxelPt.y);
    const roundedZ = Math.floor(voxelPt.z);

    return new THREE.Box3(
      new THREE.Vector3(roundedX, roundedY, roundedZ), 
      new THREE.Vector3(roundedX+1, roundedY+1, roundedZ+1)
    );
  }

  static closestVoxelIdxPt(pt) {
    return new THREE.Vector3(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z));
  }

  static calcVoxelWorldSpaceCentroid(idxSpacePt) {
    return new THREE.Vector3(
      Math.floor(idxSpacePt.x) + HALF_VOXEL_SIZE, 
      Math.floor(idxSpacePt.y) + HALF_VOXEL_SIZE,
      Math.floor(idxSpacePt.z) + HALF_VOXEL_SIZE
    );
  }

  drawFramebuffer(idx) {
    const framebuffer = this.voxelFramebuffers[idx];
    const currPt = new THREE.Vector3();
    const blendFunc = this.getDrawPointBlendFunc();

    for (let x = 0; x < framebuffer.length; x++) {
      for (let y = 0; y < framebuffer[x].length; y++) {
        for (let z = 0; z < framebuffer[x][y].length; z++) {
          blendFunc(currPt.set(x,y,z), framebuffer[x][y][z].colour);
        }
      }
    }
  }

  getDrawPointBlendFunc() {
    return (this.blendMode === BLEND_MODE_ADDITIVE ? this.addToVoxel : this.setVoxel).bind(this);
  }

  /**
   * Draw a coloured point (the point will be sampled to the nearest voxel).
   * @param {THREE.Vector3} pt - The position to draw the point at.
   * @param {THREE.Color} colour - The colour of the point
   */
  drawPoint(pt, colour) {
    const blendFunc = this.getDrawPointBlendFunc();
    blendFunc(pt, colour);
  }

 /**
   * Draw a line through voxel space from the start point to the end point with the given colour.
   * @param {Vector3} p1 - The position where the line starts, in local coordinates.
   * @param {Vector3} p2 - The position where the line ends, in local coordinates.
   * @param {Color} colour - The colour of the line.
   */
  drawLine(p1, p2, colour) {
    // Code originally written by Anthony Thyssen, original algo of Bresenham's line in 3D
    // http://www.ict.griffith.edu.au/anthony/info/graphics/bresenham.procs
    
    const blendDrawPointFunc = this.getDrawPointBlendFunc();

		let dx, dy, dz, l, m, n, dx2, dy2, dz2, i, x_inc, y_inc, z_inc, err_1, err_2;
		let currentPoint = new THREE.Vector3(p1.x, p1.y, p1.z);
		dx = p2.x - p1.x;
		dy = p2.y - p1.y;
		dz = p2.z - p1.z;
		x_inc = (dx < 0) ? -1 : 1;
		l = Math.abs(dx);
		y_inc = (dy < 0) ? -1 : 1;
		m = Math.abs(dy);
		z_inc = (dz < 0) ? -1 : 1;
		n = Math.abs(dz);
		dx2 = l * 2;
		dy2 = m * 2;
		dz2 = n * 2;

		if ((l >= m) && (l >= n)) {
			err_1 = dy2 - l;
			err_2 = dz2 - l;
			for (i = 0; i < l; i++) {
				blendDrawPointFunc(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.y += y_inc;
					err_1 -= dx2;
				}
				if (err_2 > 0) {
					currentPoint.z += z_inc;
					err_2 -= dx2;
				}
				err_1 += dy2;
				err_2 += dz2;
				currentPoint.x += x_inc;
			}
    } 
    else if ((m >= l) && (m >= n)) {
			err_1 = dx2 - m;
			err_2 = dz2 - m;
			for (i = 0; i < m; i++) {
				blendDrawPointFunc(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.x += x_inc;
					err_1 -= dy2;
				}
				if (err_2 > 0) {
					currentPoint.z += z_inc;
					err_2 -= dy2;
				}
				err_1 += dx2;
				err_2 += dz2;
				currentPoint.y += y_inc;
			}
    }
    else {
			err_1 = dy2 - n;
			err_2 = dx2 - n;
			for (i = 0; i < n; i++) {
        blendDrawPointFunc(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.y += y_inc;
					err_1 -= dz2;
				}
				if (err_2 > 0) {
					currentPoint.x += x_inc;
					err_2 -= dz2;
				}
				err_1 += dy2;
				err_2 += dx2;
				currentPoint.z += z_inc;
			}
		}

		blendDrawPointFunc(currentPoint, colour);
  }

  static voxelBoxList(minPt=new THREE.Vector3(0,0,0), maxPt=new THREE.Vector3(1,1,1), fill=false) {
    
    const voxelPts = [];
    const mappedMinPt = minPt.clone().floor();
    const mappedMaxPt  = maxPt.clone().ceil();

    if (fill) {
      for (let x = mappedMinPt.x; x < mappedMaxPt.x; x++) {
        for (let y = mappedMinPt.y; y < mappedMaxPt.y; y++) {
          for (let z = mappedMinPt.z; z < mappedMaxPt.z; z++) {
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

  drawBox(minPt=new THREE.Vector3(0,0,0), maxPt=new THREE.Vector3(1,1,1), colour=new THREE.Color(1,1,1), fill=false) {
    const boxPts = VoxelModel.voxelBoxList(minPt, maxPt, fill);
    const blendDrawPointFunc = this.getDrawPointBlendFunc();
    boxPts.forEach((pt) => {
      blendDrawPointFunc(pt, colour);
    });
  }

  voxelSphereList(center=new THREE.Vector3(0,0,0), radius=1, fill=false) {
    // Create a bounding box for the sphere: 
    // Centered at the given center with a half width/height/depth of the given radius
    const sphereBounds = new THREE.Sphere(center, radius);
    const sphereBoundingBox = new THREE.Box3(center.clone().subScalar(radius).floor(), center.clone().addScalar(radius).ceil());

    // Now we go through all the voxels in the bounding box and build a point list
    const voxelPts = [];
    for (let x = sphereBoundingBox.min.x; x <= sphereBoundingBox.max.x; x++) {
      for (let y = sphereBoundingBox.min.y; y <= sphereBoundingBox.max.y; y++) {
        for (let z = sphereBoundingBox.min.z; z <= sphereBoundingBox.max.z; z++) {
          // Check whether the current voxel is inside the radius of the sphere
          const currPt = new THREE.Vector3(x,y,z);
          const distToCurrPt = sphereBounds.distanceToPoint(currPt);
          if (fill) {
            if (distToCurrPt < VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
          else {
            if (Math.abs(distToCurrPt) < VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
        }
      }
    }

    return voxelPts;
  }

  drawSphere(center=new THREE.Vector3(0,0,0), radius=1, colour=new THREE.Color(1,1,1), fill=false) {
    const spherePts = this.voxelSphereList(center, radius, fill);
    const blendDrawPointFunc = this.getDrawPointBlendFunc();
    spherePts.forEach((pt) => {
      blendDrawPointFunc(pt, colour);
    });
  }
}

export default VoxelModel;