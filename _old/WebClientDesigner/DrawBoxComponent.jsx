import * as Rete from 'rete';
import * as THREE from 'three';

import VoxelContants from '../../src/VoxelConstants';

import {vector3Socket, eulerSocket, colourSocket, boolSocket, voxelsSocket} from './SocketDefinitions';
import {convertInputToBoolean, convertInputToColour, convertInputToVector3} from './InputTypeConversions';
import {DRAW_SUBMENU} from './ContextMenuDefinitions';

const POSITION_KEY  = "pos";
const ROTATION_KEY  = "rot";
const COLOUR_KEY    = "col";
const SCALE_KEY     = "scale";
const IS_FILLED_KEY = "isFilled";
const VOXELS_KEY    = "voxels";

const BOX_COMPONENT_NAME = "Box";

class DrawBoxComponent extends Rete.Component {
  constructor(voxelModel) {
    super(BOX_COMPONENT_NAME);
    this.contextMenuName = DRAW_SUBMENU + BOX_COMPONENT_NAME;
    this.voxelModel = voxelModel;
  }

  builder(node) {
    const inPos = new Rete.Input(POSITION_KEY, "Position", vector3Socket, false);
    const inRot = new Rete.Input(ROTATION_KEY, "Rotation", eulerSocket, false);
    const inCol = new Rete.Input(COLOUR_KEY, "Colour", colourSocket, false);
    const inScale = new Rete.Input(SCALE_KEY, "Scale", vector3Socket, false);
    const inFill  = new Rete.Input(IS_FILLED_KEY, "IsFilled", boolSocket, false);
    const outVoxels = new Rete.Output(VOXELS_KEY, "Voxels", voxelsSocket);
    return node
      .addInput(inPos)
      .addInput(inRot)
      .addInput(inCol)
      .addInput(inScale)
      .addInput(inFill)
      .addOutput(outVoxels);
  }

  worker(node, inputs, outputs) {
    //if (!this.voxelModel) { return; }

    const halfGridSize = VoxelContants.VOXEL_HALF_GRID_SIZE;
    const position = convertInputToVector3(inputs, POSITION_KEY, new THREE.Vector3(halfGridSize, halfGridSize, halfGridSize));
    //const rotation = convertInputToEuler(inputs, ROTATION_KEY);
    const colour = convertInputToColour(inputs, COLOUR_KEY);
    const scale = convertInputToVector3(inputs, SCALE_KEY, new THREE.Vector3(4,4,4));
    const isFilled = convertInputToBoolean(inputs, IS_FILLED_KEY);

  }
};

export default DrawBoxComponent;