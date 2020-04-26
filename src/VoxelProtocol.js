import * as THREE from 'three';

const DISCOVERY_REQ_PACKET_HEADER = "REQ";
const DISCOVERY_ACK_PACKET_HEADER = "ACK";

// Packet Header/Identifier Constants - TCP ONLY
const VOXEL_DATA_HEADER = "D";
// Data type constants
const VOXEL_DATA_ALL_TYPE   = "A";
const VOXEL_DATA_DIFF_TYPE  = "D";
const VOXEL_DATA_CLEAR_TYPE = "C";

// Server-to-Client Headers
const SERVER_TO_CLIENT_WELCOME_HEADER = "W";

// Client Command / Request Headers
const VOXEL_ROUTINE_CHANGE_HEADER = "C";
const VOXEL_ROUTINE_CONFIG_UPDATE_HEADER = "U";
const VOXEL_ROUTINE_RESET_HEADER = "R";
const VOXEL_CLEAR_COMMAND_HEADER = "L";

const PACKET_END = ";";

// Web Socket Communication Constants
const WEBSOCKET_HOST = "localhost";
const WEBSOCKET_PORT = 4001;

// Read/Write constants
const COLOUR_HEX_STR_LENGTH = 6;

class VoxelProtocol {

  // Packet Header/Identifier Constants for Hardware Discovery - UDP ONLY
  static get DISCOVERY_REQ_PACKET_HEADER() {return DISCOVERY_REQ_PACKET_HEADER;}
  static get DISCOVERY_ACK_PACKET_HEADER() {return DISCOVERY_ACK_PACKET_HEADER;}

  static get VOXEL_DATA_HEADER() {return VOXEL_DATA_HEADER;}
  static get VOXEL_DATA_ALL_TYPE() {return VOXEL_DATA_ALL_TYPE;}
  static get VOXEL_DATA_DIFF_TYPE() {return VOXEL_DATA_DIFF_TYPE;}
  static get VOXEL_DATA_CLEAR_TYPE() {return VOXEL_DATA_CLEAR_TYPE;}

  static get WEBSOCKET_HOST() {return WEBSOCKET_HOST;}
  static get WEBSOCKET_PORT() {return WEBSOCKET_PORT;}

  static get SERVER_TO_CLIENT_WELCOME_HEADER() {return SERVER_TO_CLIENT_WELCOME_HEADER;}

  static get VOXEL_ROUTINE_CHANGE_HEADER() {return VOXEL_ROUTINE_CHANGE_HEADER;}
  static get VOXEL_ROUTINE_CONFIG_UPDATE_HEADER() {return VOXEL_ROUTINE_CONFIG_UPDATE_HEADER;}
  static get VOXEL_ROUTINE_RESET_HEADER() {return VOXEL_ROUTINE_RESET_HEADER;}
  static get VOXEL_CLEAR_COMMAND_HEADER() {return VOXEL_CLEAR_COMMAND_HEADER;}

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
  static readClientPacketStr(packetStr, voxelModel) {
    const dataObj = JSON.parse(packetStr);
    if (!dataObj || !dataObj.packetType) {
      console.log("Unspecified client packet.");
      return false;
    }
    
    switch (dataObj.packetType) {

      case VOXEL_ROUTINE_CHANGE_HEADER:
        if (!dataObj.config || !dataObj.voxelAnimType) {
          console.log("Unspecified configuration or routine change type.");
          return false;
        }
        if (!voxelModel.setAnimator(dataObj.voxelAnimType, dataObj.config)) {
          return false;
        }
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

      default:
        return false;
    }

    return true;
  }


  static buildVoxelDataPacketStr(voxelData) {
    if (voxelData === null) {
      return "";
    }
    const {type, data} = voxelData;
    if (!type || !data) {
      console.log("Invalid voxel data object found!");
      return "";
    }

    let packetDataStr = null;
    switch (type) {

      case VOXEL_DATA_ALL_TYPE:
        packetDataStr = new Uint8Array(3 + data.length*data[0].length*data[0][0].length*3);
        let byteCount = 2;
        const xLen = data.length;
        for (let x = 0; x < xLen; x++) {
          const yLen = data[x].length;
          for (let y = 0; y < yLen; y++) {
            const zLen = data[x][y].length;
            for (let z = 0; z < zLen; z++) {

              const voxel = data[x][y][z];
              const voxelColour = voxel.colour;

              packetDataStr[byteCount]   = parseInt(voxelColour.r*255);
              packetDataStr[byteCount+1] = parseInt(voxelColour.g*255);
              packetDataStr[byteCount+2] = parseInt(voxelColour.b*255);
              byteCount += 3;
            }
          }
        }
        break;

      case VOXEL_DATA_CLEAR_TYPE:
        packetDataStr = new Uint8Array(6);
        packetDataStr[2] = parseInt(data.r*255);
        packetDataStr[3] = parseInt(data.g*255);
        packetDataStr[4] = parseInt(data.b*255);
        break;

      case VOXEL_DATA_DIFF_TYPE:
        // TODO
        break;

      default:
        return "";
    }
    packetDataStr[0] = VOXEL_DATA_HEADER.charCodeAt(0);
    packetDataStr[1] = type.charCodeAt(0);
    packetDataStr[packetDataStr.length-1] = PACKET_END.charCodeAt(0);

    return Buffer.from(packetDataStr);
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

  static readAndPaintVoxelDataAll(packetDataStr, voxelDisplay) {
    
    const displayXSize = voxelDisplay.xSize();
    const displayYSize = voxelDisplay.ySize();
    const displayZSize = voxelDisplay.zSize();

    let currIdx = VOXEL_DATA_HEADER.length + VOXEL_DATA_ALL_TYPE.length;

    if (packetDataStr.length < currIdx + 3*displayXSize*displayYSize*displayZSize) {
      console.log("Voxel data was invalid (package was not long enough).");
      return false;
    }

    for (let x = 0; x < displayXSize; x++) {
      for (let y = 0; y < displayYSize; y++) {
        for (let z = 0; z < displayZSize; z++) {
          const r = packetDataStr[currIdx]/255;
          const g = packetDataStr[currIdx+1]/255;
          const b = packetDataStr[currIdx+2]/255;
          voxelDisplay.setVoxelXYZRGB(x, y, z, r, g, b);
          currIdx += 3;
        }
      }
    }

    return true;
  }

  static readAndPaintVoxelDataClear(packetDataStr, voxelDisplay) {
    const startIdx = VOXEL_DATA_HEADER.length + VOXEL_DATA_CLEAR_TYPE.length;
    if (packetDataStr.length < startIdx + 3) {
      return false;
    }
    const r = packetDataStr[startIdx]/255;
    const g = packetDataStr[startIdx+1]/255;
    const b = packetDataStr[startIdx+2]/255;

    voxelDisplay.clearRGB(r,g,b);
    return true;
  }


};

export default VoxelProtocol;