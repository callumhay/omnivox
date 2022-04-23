import * as THREE from 'three';
import VoxelConstants from '../VoxelConstants';

import VTAmbientLight from "../VoxelTracer/VTAmbientLight";
import VTBox, {defaultBoxOptions} from "../VoxelTracer/VTBox";
import VTConstants from '../VoxelTracer/VTConstants';
import VTEmissionMaterial from '../VoxelTracer/VTEmissionMaterial';
import VTLambertMaterial from "../VoxelTracer/VTLambertMaterial";

import VoxelAnimator from "./VoxelAnimator";

//const STATE_TYPE_SLICES_MOVE    = 1;
//const STATE_TYPE_BOXES_MOVE     = 2;
//const STATE_TYPE_BOXES_JOINED   = 3;
//const STATE_TYPE_BOXES_OUTLINED = 4;
//const STATE_TYPE_FINISHED       = 5;

const boxSliceSize = 8;
const halfBoxSliceSize = boxSliceSize/2;
const adjBoxSize = boxSliceSize-1;
const boxSize = new THREE.Vector3(adjBoxSize, adjBoxSize, adjBoxSize);
const overlapAmount = 1.5;
const boxOptions = {samplesPerVoxel: 4, castsShadows: false, receivesShadows: false};

class StartupAnimator extends VoxelAnimator {
  constructor(voxelModel, scene) {
    super(voxelModel);
    this.scene = scene;
    this.reset();
    this._objectsBuilt = false;
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STARTUP; }
  rendersToCPUOnly() { return true; }

  setConfig(c) {
    super.setConfig(c);
    if (!this.scene) { return; }
    this.scene.clear();

    if (!this._objectsBuilt) {
      this._boxSlices = [
        ...this._buildBoxSlices(true), // These slices will be positioned starting at x=y=z=[0,7]
        ...this._buildBoxSlices(false) // These slices will be positioned starting at x=y=z=[8,15]
      ];

      this._boxMin = new VTBox(
        new THREE.Vector3(halfBoxSliceSize, halfBoxSliceSize, halfBoxSliceSize), 
        boxSize.clone(),
        new VTLambertMaterial(new THREE.Color(1,1,1)), {...boxOptions, fill: true}
      );
      this._boxMax = new VTBox(
        new THREE.Vector3(boxSliceSize+halfBoxSliceSize, boxSliceSize+halfBoxSliceSize, boxSliceSize+halfBoxSliceSize), 
        boxSize.clone(),
        new VTLambertMaterial(new THREE.Color(1,1,1)), {...boxOptions, fill: true}
      );

      this._ambientLight = new VTAmbientLight(new THREE.Color(1,1,1));
    
      this._objectsBuilt = true;
    }

    this.scene.addObject(this._ambientLight);
    for (const slice of this._boxSlices) { this.scene.addObject(slice.box); }

  }

  reset() {
    super.reset();
    this._objectsBuilt = false;
    this.currStateFunc = this._sliceMoveStateFunc.bind(this); // Reinitialize to the start state
    this.setConfig(this.config);
  }

  async render(dt) {
    if (!this._objectsBuilt || !this._isConnected()) { return; }
    const dtSafe = Math.min(dt, 1.0/30.0);
    this.currStateFunc(dtSafe); // Execute the current state
    await this.scene.render();
  }

  _sliceMoveStateFunc(dt) {
    for (const slice of this._boxSlices) {
      const endAnimTime = slice.startAnimTime + slice.totalAnimTime;
      slice.currAnimTime = Math.min(endAnimTime, (dt + slice.currAnimTime));
      const {box, startY, endY, currAnimTime, startAnimTime} = slice;
      const currYPos = startY + (endY-startY)*THREE.MathUtils.smoothstep(currAnimTime, startAnimTime, endAnimTime);
      box.position.set(box.position.x, currYPos, box.position.z);
      box.makeDirty();
    }

    // If the last slice is finished getting into position then this state of the animation is done
    const lastSlice = this._boxSlices[this._boxSlices.length-1];
    if (lastSlice.currAnimTime >= (lastSlice.startAnimTime + lastSlice.totalAnimTime)) {
      
      // Move to the next state, replace the slices with two boxes
      this.currStateFunc = this._boxMoveToOverlapStateFunc.bind(this);
      for (const slice of this._boxSlices) {
        this.scene.removeObject(slice.box);
      }
      this.scene.addObject(this._boxMin);
      this.scene.addObject(this._boxMax);

      const overlapAnimTime = 0.25;
      const boxMinStartPos = this._boxMin.position.clone();
      const boxMaxStartPos = this._boxMax.position.clone();
      this._boxOverlapAnimations = [
        {box: this._boxMin, startPos: boxMinStartPos, endPos: boxMinStartPos.clone().addScalar(overlapAmount), currAnimTime: 0, totalAnimTime:overlapAnimTime},
        {box: this._boxMax, startPos: boxMaxStartPos, endPos: boxMaxStartPos.clone().subScalar(overlapAmount), currAnimTime: 0, totalAnimTime:overlapAnimTime},
      ];
    }
  }
  _boxMoveToOverlapStateFunc(dt) {
    let isFinished = true;
    for (const anim of this._boxOverlapAnimations) {
      anim.currAnimTime = Math.min(anim.totalAnimTime, anim.currAnimTime + dt);
      const {box, startPos, endPos, currAnimTime, totalAnimTime} = anim;
      box.position.lerpVectors(startPos, endPos, THREE.MathUtils.smoothstep(currAnimTime, 0, totalAnimTime));
      box.makeDirty();
      isFinished &= (currAnimTime >= totalAnimTime);
    }

    if (isFinished) {
      this.currStateFunc = this._boxJoinedStateFunc.bind(this);

      const outlineDrawOrder = VTConstants.DRAW_ORDER_DEFAULT+3;
      this._boxOutlineMin = new VTBox(
        this._boxMin.position.clone(), boxSize.clone().addScalar(2), 
        new VTLambertMaterial(new THREE.Color(1,0,0)), {...boxOptions, fill:false}
      );
      this._boxOutlineMin.drawOrder = outlineDrawOrder;
      this._boxOutlineMax = new VTBox(
        this._boxMax.position.clone(), boxSize.clone().addScalar(2), 
        new VTLambertMaterial(new THREE.Color(1,0,0)), {...boxOptions, fill:false}
      );
      this._boxOutlineMax.drawOrder = outlineDrawOrder;
    }

  }
  _boxJoinedStateFunc(dt) {
    this.scene.addObject(this._boxOutlineMin);
    this.scene.addObject(this._boxOutlineMax);
    this.currStateFunc = this._endStateFunc.bind(this);
  }
  _endStateFunc(dt) {}


  _buildBoxSlices(isMin) {
    const sliceMoveTimeS = 0.25;
    const sliceMoveTimeGapS = 0.05;

    const startX = isMin ? 0 : 9;
    const endX   = isMin ? 8 : 16;

    const startY = isMin ? boxSliceSize*2+halfBoxSliceSize+1 : -(halfBoxSliceSize+1);
    const endY = isMin ? halfBoxSliceSize-0.5 : 16-(halfBoxSliceSize-1);

    const zPosition = halfBoxSliceSize + (isMin ? -0.5 : 8.5);

    const slices = [];
    for (let x = startX; x < endX; x++) {
      const box = new VTBox(
        new THREE.Vector3(x, startY, zPosition),
        new THREE.Vector3(1, boxSliceSize, boxSliceSize),
        new VTLambertMaterial(new THREE.Color(1,1,1))
      );
      slices.push({box, startY, endY, currAnimTime:0, startAnimTime:sliceMoveTimeGapS*x, totalAnimTime:sliceMoveTimeS});
    }

    return slices;
  }

  _isConnected() {
    const {voxelServer} = this.voxelModel;
    return voxelServer && voxelServer.viewerWS; // TODO: Check if slaves are connected here.
  }

}

export default StartupAnimator;