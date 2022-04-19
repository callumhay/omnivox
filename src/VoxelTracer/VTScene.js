import * as THREE from 'three';
import os from 'os';
import path from 'path';
import {fork} from 'child_process';

import VTObject from './VTObject';
import VTRenderProc from './RenderProc/VTRenderProc';

import VoxelGeometryUtils from '../VoxelGeometryUtils';
import VTConstants from './VTConstants';

class VTScene {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;

    this.childProcesses = [];

    this.renderables = [];
    this.lights = [];
    this.ambientLight = null; // Special kind of light, only one instance of it is allowed

    this.nextId = 0;
    this._dirtyRemovedObjIds = [];

    this._renderCount = 0;
    this._forkChildProcesses();
  }

  get gridSize() { return this.voxelModel.gridSize; }
  getVoxelGridBoundingBox() { return this.voxelModel.getBoundingBox(); }

  clear() {
    this.renderables = [];
    this.lights = [];
    this.ambientLight = null;
    this.nextId = 0;

    this._updateChildRenderProcsFromScene(true);
    this._dirtyRemovedObjIds = [];
  }

  addObject(o) {
    if (!(o instanceof VTObject)) { console.error("Cannot add an object that doesn't inherit from VTObject."); return; } // TODO: Update this to VTRPObject
    switch (o.type) {
      case VTConstants.AMBIENT_LIGHT_TYPE:
        this.ambientLight = o;
        break;
      case VTConstants.POINT_LIGHT_TYPE:
      case VTConstants.SPOT_LIGHT_TYPE:
        this.renderables.push(o);
      case VTConstants.DIRECTIONAL_LIGHT_TYPE: // N.B., Directional lights are not rendered as objects
        this.lights.push(o);
        break;

      default:
        this.renderables.push(o);
        break;
    }
    o.makeDirty();
    o.id = this.nextId++;
  }

  removeObject(o) {
    let index = this.renderables.indexOf(o);
    if (index > -1) {
      this.renderables.splice(index, 1);
      this._dirtyRemovedObjIds.push(o.id);
    }
    index = this.lights.indexOf(o);
    if (index > -1) {
      this.lights.splice(index, 1);
    }
    o.id = VTConstants.INVALID_RENDERABLE_ID;
  }

  async render() {
    this._renderCount = 0;
    this._updateChildRenderProcsFromScene();
    for (let i = 0; i < this.childProcesses.length; i++) {
      this.childProcesses[i].send({type: VTRenderProc.TO_PROC_RENDER});
    }

    const self = this;
    const waitForRenderToFinish = () => {
      const poll = resolve => {
        if (self._renderCount === self.childProcesses.length) {
          resolve();
        }
        else {
          setImmediate(() => poll(resolve));
        }
      }
      return new Promise(poll);
    };

    await waitForRenderToFinish();
  }

  _renderFromChildProcData(renderedVoxels) {
    if (renderedVoxels && renderedVoxels.length > 0) { 
      const voxelPt = new THREE.Vector3();
      const voxelColour = new THREE.Color();
      for (let i = 0; i < renderedVoxels.length; i++) {
        const {pt, colour} = renderedVoxels[i];

        voxelPt.set(pt.x, pt.y, pt.z);
        voxelColour.setHex(colour);

        this.voxelModel.addToVoxelFast(voxelPt, voxelColour);
      }
    }
    this._renderCount++;
  }

  _getChildProcUpdateAndDirty(reinit=false) {
    let dirty = [];
    let updatedRenderables = [];
    let updatedLights = [];
    let updatedAmbientLight = null;

    if (reinit) {
      updatedRenderables = [...this.renderables];
      updatedLights = [...this.lights];
      if (this.ambientLight) {
        updatedAmbientLight = this.ambientLight;
        dirty.push(this.ambientLight);
      }
      dirty = [...this.renderables];
    }
    else {
      // N.B., Any lights that are renderables as well are already in the renderables (so we don't need to loop through and add those)
      for (let i = 0; i < this.renderables.length; i++) {
        const renderable = this.renderables[i];
        if (renderable.isDirty()) {
          updatedRenderables.push(renderable);
          dirty.push(renderable);
        }
      }
      for (let i = 0; i < this.lights.length; i++) {
        const light = this.lights[i];
        if (light.isDirty()) {
          updatedLights.push(light);
          // N.B., Lights are already renderables so we don't need to add them to the dirty array
        }
      }
      if (this.ambientLight && this.ambientLight.isDirty()) {
        updatedAmbientLight = this.ambientLight;
        dirty.push(this.ambientLight);
      }
    }

    // NOTE: We don't include shadowcasters here because it is memoize-able data and can be derived by the child processes
    const childProcUpdate = {
      reinit: reinit,
      renderables: updatedRenderables,
      lights: updatedLights,
      ambientLight: updatedAmbientLight,
    };

    return {childProcUpdate: childProcUpdate, dirty: dirty};
  }

  _updateChildRenderProcsFromScene(reinitAll=false) {
    // Make sure the child processes know about any removed objects
    if (this._dirtyRemovedObjIds.length > 0) {
      const updateData = {removedIds: this._dirtyRemovedObjIds};
      for (let i = 0; i < this.childProcesses.length; i++) {
        this.childProcesses[i].send({type: VTRenderProc.TO_PROC_UPDATE_SCENE, data: updateData});
      }
      this._dirtyRemovedObjIds = [];
    }

    const {childProcUpdate, dirty} = this._getChildProcUpdateAndDirty(reinitAll);

    // Update all the dirty items so they have the most up-to-date data in them and
    // are ready to be sent to the child render processes
    for (let i = 0; i < dirty.length; i++) {
      const dirtyObj = dirty[i];
      dirtyObj.unDirty();
    }
    
    const boundingBox = this.getVoxelGridBoundingBox();
    const updatedRenderableVoxels = VTScene.getRenderableVoxels(childProcUpdate.renderables, boundingBox);
    const chunkedChildProcData = this._chunkRenderableVoxels(updatedRenderableVoxels);

    for (let i = 0; i < this.childProcesses.length; i++) {
      const currChildProc = this.childProcesses[i];

      const updateVoxelInfoObj = {reinit: reinitAll, mapping: chunkedChildProcData[i]};
      if (!reinitAll) { updateVoxelInfoObj['updatedRenderableVoxels'] = updatedRenderableVoxels; }

      currChildProc.send({type: VTRenderProc.TO_PROC_UPDATE_VOXEL_INFO, data: updateVoxelInfoObj});
      currChildProc.send({type: VTRenderProc.TO_PROC_UPDATE_SCENE, data: childProcUpdate});
    }
  }

  static debugInspectIsOn() {
    //console.log("DEBUG ON? " + process.execArgv.filter(arg => arg.indexOf('--inspect') !== -1).length > 0);
    return process.execArgv.filter(arg => arg.indexOf('--inspect') !== -1).length > 0;
  }

  static calcNumChildProcesses() {
    return (VTScene.debugInspectIsOn()) ? 1 : os.cpus().length;
  }

  killChildProcesses() {
    for (let i = 0; i < this.childProcesses.length; i++) {
      if (!this.childProcesses[i].kill()) {
        console.error("Failed to properly kill child process.");
      }
    }
    this.childProcesses = this.childProcesses.filter(c => !c.killed || c.connected);
  }

  _forkChildProcesses() {
    const self = this;

    const program = path.resolve('dist/vtrenderproc.js');
    const programArgs = [];
    const allChildsOptions = {
      stdio: [0, 1, 2, 'ipc'],
      execArgv: [],
    };
    
    const CHILD_PROC_NAME = "VTRenderProc";
    let childInspectPort = 31310;
    const debugInspectIsOn = VTScene.debugInspectIsOn();
    const numForks = VTScene.calcNumChildProcesses();
    for (let i = 0; i < numForks; i++) {
      // When debugging node applications we need to make sure each child process has its own inspect port assigned
      // or the program will crash and burn
      let childOptions = allChildsOptions;
      if (debugInspectIsOn) {
        childOptions = {...allChildsOptions,
          execArgv: [...allChildsOptions.execArgv,
            `--inspect=${childInspectPort++}`
          ]
        };
      }
      
      // This will fork off a new child render process
      const childProc = fork(program, programArgs, childOptions);
      this.childProcesses.push(childProc);
      
      // Setup the child process for various messages between it and this parent process
      childProc.on('message', message => {
        switch (message.type) {
          case VTRenderProc.FROM_PROC_RENDERED:
            self._renderFromChildProcData(message.data);
            break;

          default:
            console.log(`Invalid message type recieved from ${CHILD_PROC_NAME}.`);
            break;
        }
      });

      childProc.on('error', err => console.log(`${CHILD_PROC_NAME} error: ${err}`));
      childProc.on('close', code => console.log(`${CHILD_PROC_NAME} has closed all stdio with code ${code}.`));

      childProc.on('exit', code => {
        console.log(`${CHILD_PROC_NAME} has exited with code ${code}.`);
        // Remove the child process from the renderer
        this.childProcesses = this.childProcesses.filter(c => c !== childProc);
      });
    }

    this._initChildProcesses();
  }

  static getRenderableVoxels(visibleRenderables, boundingBox) {
    let renderableVoxels = [];
    for (let i = 0; i < visibleRenderables.length; i++) {
      // Get all of the voxels that collide with the renderable object
      const renderable = visibleRenderables[i];
      const voxelPts = renderable.getCollidingVoxels(boundingBox);
      if (voxelPts.length > 0) {
        renderableVoxels.push.apply(renderableVoxels, voxelPts.map(vPt => ({voxelPt: vPt, renderableId: renderable.id})));
      }
    }

    return renderableVoxels;
  }

  _chunkRenderableVoxels(renderableVoxels) {
    const numChildProcs = VTScene.calcNumChildProcesses();
    if (renderableVoxels.length === 0) {
      return new Array(numChildProcs).fill().map(() => ({}));
    }

    // Ordering is important here - the children are only given the voxels in their respective intervals. These intervals are designated as
    // the total number of voxels divided by the total number of children (if it's an uneven division then the last child gets the lesser quantity).
    const numVoxels = this.voxelModel.numVoxels();
    const numVoxelsPerProc = Math.ceil(numVoxels / numChildProcs);

    const chunkedRenderData = new Array(numChildProcs).fill().map(() => ({}));
    for (let i = 0; i < renderableVoxels.length; i++) {
      const renderableVoxel = renderableVoxels[i];
      const voxelIdx = VoxelGeometryUtils.voxelFlatIdx(renderableVoxel.voxelPt, this.voxelModel.gridSize);
      if (voxelIdx >= 0 && voxelIdx < numVoxels) { 
        const childProcIdx = Math.floor(voxelIdx / numVoxelsPerProc);
        const childProcChunk = chunkedRenderData[childProcIdx];

        if (!(renderableVoxel.renderableId in childProcChunk)) {
          childProcChunk[renderableVoxel.renderableId] = [];
        }
        childProcChunk[renderableVoxel.renderableId].push(renderableVoxel.voxelPt);
      }
    }

    return chunkedRenderData;
  }

  _initChildProcesses() {
    const numVoxels = this.voxelModel.numVoxels();
    const numVoxelsPerProc = Math.ceil(numVoxels / this.childProcesses.length);

    // Tell each of the child processes which voxel indices they're responsible for
    for (let i = 0; i < this.childProcesses.length; i++) {
      const currChildProc = this.childProcesses[i];
      currChildProc.send({
        type: VTRenderProc.TO_PROC_INIT, 
        data: {
          voxelIndexRange: [i*numVoxelsPerProc, i*numVoxelsPerProc + numVoxelsPerProc - 1], 
          gridSize: this.voxelModel.gridSize
        }
      });
    }

    this._updateChildRenderProcsFromScene(true);
  }

}

export default VTScene;