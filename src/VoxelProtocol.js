import * as THREE from 'three';
import { hashCode } from './MathUtils';

const DISCOVERY_REQ_PACKET_HEADER = "REQ";
const DISCOVERY_ACK_PACKET_HEADER = "ACK";

// Packet Header/Identifier Constants
const VOXEL_DATA_HEADER = "D";
// Data type constants
const VOXEL_DATA_ALL_TYPE   = "A";

// Server-to-Client Headers
const SERVER_TO_CLIENT_WELCOME_HEADER = "W";
const SERVER_TO_CLIENT_SCENE_FRAMEBUFFER_HEADER = "F";

// Client Command / Request Headers
const FULL_STATE_UPDATE_HEADER = "F";
const VOXEL_ROUTINE_CHANGE_HEADER = "C";
const VOXEL_ROUTINE_CONFIG_UPDATE_HEADER = "U";
const VOXEL_ROUTINE_RESET_HEADER = "R";
const VOXEL_CLEAR_COMMAND_HEADER = "L";
const AUDIO_INFO_HEADER = "A";

const PACKET_END = ";";

// Web Socket Communication Constants
const WEBSOCKET_HOST = "localhost";
const WEBSOCKET_PORT = 4001;

const VOXEL_MODULE_X_SIZE = 8;
const VOXEL_MODULE_Z_SIZE = 8;


class VoxelProtocol {

  // Packet Header/Identifier Constants for Hardware Discovery - UDP ONLY
  static get DISCOVERY_REQ_PACKET_HEADER() {return DISCOVERY_REQ_PACKET_HEADER;}
  static get DISCOVERY_ACK_PACKET_HEADER() {return DISCOVERY_ACK_PACKET_HEADER;}

  static get VOXEL_DATA_HEADER() {return VOXEL_DATA_HEADER;}
  static get VOXEL_DATA_ALL_TYPE() {return VOXEL_DATA_ALL_TYPE;}

  static get WEBSOCKET_HOST() {return WEBSOCKET_HOST;}
  static get WEBSOCKET_PORT() {return WEBSOCKET_PORT;}

  static get SERVER_TO_CLIENT_WELCOME_HEADER() {return SERVER_TO_CLIENT_WELCOME_HEADER;}
  static get SERVER_TO_CLIENT_SCENE_FRAMEBUFFER_HEADER() {return SERVER_TO_CLIENT_SCENE_FRAMEBUFFER_HEADER;}

  static get FULL_STATE_UPDATE_HEADER() {return FULL_STATE_UPDATE_HEADER;}
  static get VOXEL_ROUTINE_CHANGE_HEADER() {return VOXEL_ROUTINE_CHANGE_HEADER;}
  static get VOXEL_ROUTINE_CONFIG_UPDATE_HEADER() {return VOXEL_ROUTINE_CONFIG_UPDATE_HEADER;}
  static get VOXEL_ROUTINE_RESET_HEADER() {return VOXEL_ROUTINE_RESET_HEADER;}
  static get VOXEL_CLEAR_COMMAND_HEADER() {return VOXEL_CLEAR_COMMAND_HEADER;}
  static get AUDIO_INFO_HEADER() {return AUDIO_INFO_HEADER;}

  static buildWelcomePacketForSlaves(voxelModel) {
    const packetDataBuf = new Uint8Array(3); // slaveid (1 byte), type (1 byte), y-size (1 byte)
    packetDataBuf[0] = 0;
    packetDataBuf[1] = SERVER_TO_CLIENT_WELCOME_HEADER.charCodeAt(0);
    packetDataBuf[2] = voxelModel.ySize();
    return Buffer.from(packetDataBuf);
  }

  static buildClientWelcomePacketStr(voxelModel) {
    const welcomeDataObj = {
      currentAnimatorType: voxelModel.currentAnimator ? voxelModel.currentAnimator.getType() : null,
      currentAnimatorConfig: voxelModel.currentAnimator ? voxelModel.currentAnimator.config : null,
    };
    const gridSizeCharCode = String.fromCharCode(voxelModel.gridSize);
    if (gridSizeCharCode.length !== 1) {
      console.log("ERROR: Grid size is too large!");
    } 

    return SERVER_TO_CLIENT_WELCOME_HEADER + String.fromCharCode(voxelModel.gridSize).charAt(0) + JSON.stringify(welcomeDataObj) + ";";
  }
  static getDataObjFromWelcomePacketStr(packetStr) {
    const gridSize = packetStr.charCodeAt(SERVER_TO_CLIENT_WELCOME_HEADER.length);
    const welcomeDataObj = JSON.parse(packetStr.substring(SERVER_TO_CLIENT_WELCOME_HEADER.length+1, packetStr.length-1));
    if (!welcomeDataObj) {
      return null;
    }
    welcomeDataObj['gridSize'] = gridSize;
    return welcomeDataObj;
  }

  static buildClientPacketStr(packetType, voxelAnimType, config) {
    THREE.Color.toJSON = () => ({r: this.r, g: this.g, b: this.b});
    return JSON.stringify({
      packetType: packetType,
      voxelAnimType: voxelAnimType,
      config: config,
    });
  }
  static buildClientPacketStrAudio(audioInfo) {
    return JSON.stringify({
      packetType: AUDIO_INFO_HEADER,
      audioInfo: {...audioInfo,
        fft: Array.apply([], audioInfo.fft)
      },
    });
  }
  static readClientPacketStr(packetStr, voxelModel, socket) {
    const dataObj = JSON.parse(packetStr);
    if (!dataObj || !dataObj.packetType) {
      console.log("Unspecified client packet.");
      return false;
    }
    
    switch (dataObj.packetType) {
      case FULL_STATE_UPDATE_HEADER:
        // We need to let the client know the full server state
        socket.send(VoxelProtocol.buildClientWelcomePacketStr(voxelModel));
        break;

      case VOXEL_ROUTINE_CHANGE_HEADER:
        if (!dataObj.config || !dataObj.voxelAnimType) {
          console.log("Unspecified configuration or routine change type.");
          return false;
        }
        if (!voxelModel.setAnimator(dataObj.voxelAnimType, dataObj.config)) {
          return false;
        }
        //console.log("Animator routine changed.");
        break;

      case VOXEL_ROUTINE_CONFIG_UPDATE_HEADER:
        if (voxelModel.currentAnimator) {
          voxelModel.currentAnimator.setConfig(dataObj.config);
        }
        break;

      case VOXEL_ROUTINE_RESET_HEADER:
        if (voxelModel.currentAnimator) {
          voxelModel.currentAnimator.reset();
        }
        break;

      case VOXEL_CLEAR_COMMAND_HEADER:
        const {config} = dataObj;
        if (!config || config.r === undefined || config.g === undefined || config.b === undefined) {
          console.log("Invalid config for clear colour.");
          return false;
        }
        voxelModel.clear(new THREE.Color(config.r, config.g, config.b));
        break;

      case AUDIO_INFO_HEADER:
        if (voxelModel.currentAnimator && voxelModel.currentAnimator.setAudioInfo) {
          voxelModel.currentAnimator.setAudioInfo(dataObj.audioInfo);
        }
        break;

      default:
        return false;
    }

    return true;
  }

  static stuffVoxelDataAll(startIdx, packetBuf, data, slaveId = null) {
    let byteCount = startIdx;

    if (slaveId !== null) {
      // We split voxels up among the slave boards based on their ID
      const xLen = data.length;
      const startX = slaveId * VOXEL_MODULE_X_SIZE;
      const endX = Math.min(xLen, startX + VOXEL_MODULE_X_SIZE);

      for (let x = startX; x < endX; x++) {
        const yLen = data[x].length;

        for (let y = 0; y < yLen; y++) {
          const zLen = data[x][y].length;
          const startZ = (slaveId % zLen) * VOXEL_MODULE_Z_SIZE;
          const endZ   = Math.min(zLen, startZ + VOXEL_MODULE_Z_SIZE); 

          for (let z = startZ; z < endZ; z++) {
            const voxel = data[x][y][z];
            const voxelColour = voxel.colour;

            packetBuf[byteCount]   = parseInt(voxelColour.r*255);
            packetBuf[byteCount+1] = parseInt(voxelColour.g*255);
            packetBuf[byteCount+2] = parseInt(voxelColour.b*255);
            byteCount += 3;
          }
        }
      }
    }
    else {
      const xLen = data.length;
      for (let x = 0; x < xLen; x++) {
        const yLen = data[x].length;
        for (let y = 0; y < yLen; y++) {
          const zLen = data[x][y].length;
          for (let z = 0; z < zLen; z++) {
            const voxel = data[x][y][z];
            const voxelColour = voxel.colour;

            packetBuf[byteCount]   = parseInt(voxelColour.r*255);
            packetBuf[byteCount+1] = parseInt(voxelColour.g*255);
            packetBuf[byteCount+2] = parseInt(voxelColour.b*255);
            byteCount += 3;
          }
        }
      }
    }
  }

  static buildVoxelDataPacket(voxelData) {
    if (voxelData === null) {
      return null;
    }
    const {type, data} = voxelData;
    if (!type || !data) {
      console.log("Invalid voxel data object found!");
      return null;
    }

    let packetDataBuf = null;

    switch (type) {
      case VOXEL_DATA_ALL_TYPE:
        packetDataBuf = new Uint8Array(5 + data.length*data[0].length*data[0][0].length*3); // type (1 byte), subtype (1 byte), frame id (2 bytes), end delimiter (1 byte), and data (3*O(n^3) bytes)
        this.stuffVoxelDataAll(4, packetDataBuf, data);
        break;

      default:
        console.error("Invalid packet data type, could not construct.");
        return null;
    }

    let frameId0 = (voxelData.frameId % 65536) >> 8;
    let frameId1 = (voxelData.frameId % 256);
    //console.log("Frame ID: " + voxelData.frameId + " - bytes: " + frameId0 + " " + frameId1 + " reconstructed: " + ((frameId0 << 8) + frameId1));

    packetDataBuf[0] = VOXEL_DATA_HEADER.charCodeAt(0);
    packetDataBuf[1] = type.charCodeAt(0);
    packetDataBuf[2] = frameId0;
    packetDataBuf[3] = frameId1;

    packetDataBuf[packetDataBuf.length-1] = PACKET_END.charCodeAt(0);

    return Buffer.from(packetDataBuf);
  }

  static buildVoxelDataPacketForSlaves(voxelData, slaveId = 0) {
    if (voxelData === null) {
      return null;
    }
    const {type, data} = voxelData;
    if (!type || !data) {
      console.log("Invalid voxel data object found!");
      return null;
    }

    let packetDataBuf = null;

    switch (type) {
      case VOXEL_DATA_ALL_TYPE:
        packetDataBuf = new Uint8Array(4 + data.length*data[0].length*data[0][0].length*3); // slaveid (1 byte), type (1 byte), frame id (2 bytes), and data (3*O(n^3) bytes)
        this.stuffVoxelDataAll(4, packetDataBuf, data, slaveId);
        break;

      default:
        console.error("Invalid packet data type, could not construct.");
        return null;
    }

    let frameId0 = (voxelData.frameId % 65536) >> 8;
    let frameId1 = (voxelData.frameId % 256);

    packetDataBuf[0] = slaveId;
    packetDataBuf[1] = type.charCodeAt(0);
    packetDataBuf[2] = frameId0;
    packetDataBuf[3] = frameId1;

    return Buffer.from(packetDataBuf);
  }

  static readPacketType(packetData) {
    if (typeof packetData === 'string') {
      return packetData.substr(0,1);
    }
    return String.fromCharCode(packetData[0]);
  }
  static readVoxelDataType(packetData) {
    if (typeof packetData === 'string') {
      return packetData.substr(1,1);
    }
    return String.fromCharCode(packetData[1]);
  }
  static readFrameId(packetData) {
    if (packetData === 'string') {
      return (parseInt(packetData.substr(2,1)) << 8) + parseInt(packetData.substr(3,1));
    }
    return (parseInt(packetData[2]) << 8) + parseInt(packetData[3]);
  }

  static readAndPaintVoxelDataAll(packetDataBuf, voxelDisplay, lastFrameHashCode) {
    
    const displayXSize = voxelDisplay.xSize();
    const displayYSize = voxelDisplay.ySize();
    const displayZSize = voxelDisplay.zSize();

    let currIdx = VOXEL_DATA_HEADER.length + VOXEL_DATA_ALL_TYPE.length + 2; // skip over the: type (1 byte), subtype (1 byte), frame Id (2 bytes)

    if (packetDataBuf.length < currIdx + 3*displayXSize*displayYSize*displayZSize) {
      console.log("Voxel data was invalid (package was not long enough).");
      return -1;
    }

    let currFrameHashCode = hashCode(packetDataBuf.slice(currIdx));
    if (lastFrameHashCode !== currFrameHashCode) {
      for (let x = 0; x < displayXSize; x++) {
        for (let y = 0; y < displayYSize; y++) {
          for (let z = 0; z < displayZSize; z++) {
            const r = packetDataBuf[currIdx]/255;
            const g = packetDataBuf[currIdx+1]/255;
            const b = packetDataBuf[currIdx+2]/255;
            voxelDisplay.setVoxelXYZRGB(x, y, z, r, g, b);
            currIdx += 3;
          }
        }
      }
    }

    return currFrameHashCode;
  }
};

export default VoxelProtocol;