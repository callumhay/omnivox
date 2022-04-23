import * as THREE from 'three';
import { hashCode } from './MathUtils';
import VoxelConstants from './VoxelConstants';

const NUM_OCTO_DATA_PINS = 8;

const DISCOVERY_REQ_PACKET_HEADER = "REQ";
const DISCOVERY_ACK_PACKET_HEADER = "ACK";

// Protocol identifiers
const WEBSOCKET_PROTOCOL_CONTROLLER = "controller";
const WEBSOCKET_PROTOCOL_VIEWER = "viewer";

// NOTE: All packet header constants MUST be a single character string!!!

// Packet Header/Identifier Constants
const SERVER_STATE_EVENT_HEADER = "S";
const SOUND_EVENT_HEADER = "N";
const VOXEL_DATA_HEADER = "D";

// SERVER_STATE_EVENT_HEADER : Event type constants
const SERVER_STATE_EVENT_FULL_TYPE  = "F";
const SERVER_STATE_EVENT_SLAVE_TYPE = "V";

// SOUND_EVENT_HEADER: Event type constants
const SOUND_EVENT_LOAD_TYPE   = "L";
const SOUND_EVENT_UNLOAD_TYPE = "U";
const SOUND_EVENT_PLAY_TYPE   = "P";
const SOUND_EVENT_STOP_TYPE   = "S";

// VOXEL_DATA_HEADER: Data type constants
const VOXEL_DATA_ALL_TYPE = "A";


// Server-to-Client Headers
const SERVER_TO_CLIENT_WELCOME_HEADER = "W";
const SERVER_TO_CLIENT_SCENE_FRAMEBUFFER_HEADER = "F";

// Client Command / Request Headers
const FULL_STATE_UPDATE_HEADER = "F";
const VOXEL_ROUTINE_CHANGE_HEADER = "C";
const VOXEL_ROUTINE_RESET_HEADER = "R";
const VOXEL_CLEAR_COMMAND_HEADER = "L";
const AUDIO_INFO_HEADER = "A";
const CROSSFADE_UPDATE_HEADER = "X";
const BRIGHTNESS_UPDATE_HEADER = "B";
const GAMEPAD_AXIS_HEADER = "G";
const GAMEPAD_BUTTON_HEADER = "T";
const GAMEPAD_STATUS_HEADER = "S";

const PACKET_END = ";";

// Web Socket Communication Constants
const WEBSOCKET_HOST = "localhost";
const WEBSOCKET_PORT = 4001;


// Gamma correction for Neopixel LED strips - maps each of R, G, and B from uint8 value
// to a gamma corrected uint8 value ****************************************************
/*
const GAMMA_MAP_ADAFRUIT = [
    0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
    0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  1,  1,  1,  1,
    1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  2,  2,  2,  2,  2,  2,
    2,  3,  3,  3,  3,  3,  3,  3,  4,  4,  4,  4,  4,  5,  5,  5,
    5,  6,  6,  6,  6,  7,  7,  7,  7,  8,  8,  8,  9,  9,  9, 10,
   10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16,
   17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24, 25,
   25, 26, 27, 27, 28, 29, 29, 30, 31, 32, 32, 33, 34, 35, 35, 36,
   37, 38, 39, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 50,
   51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68,
   69, 70, 72, 73, 74, 75, 77, 78, 79, 81, 82, 83, 85, 86, 87, 89,
   90, 92, 93, 95, 96, 98, 99,101,102,104,105,107,109,110,112,114,
  115,117,119,120,122,124,126,127,129,131,133,135,137,138,140,142,
  144,146,148,150,152,154,156,158,160,162,164,167,169,171,173,175,
  177,180,182,184,186,189,191,193,196,198,200,203,205,208,210,213,
  215,218,220,223,225,228,231,233,236,239,241,244,247,249,252,255
];
*/
const GAMMA_MAP_RGB123 = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2,
  2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
  6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 11, 11,
  11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18,
  19, 19, 20, 21, 21, 22, 22, 23, 23, 24, 25, 25, 26, 27, 27, 28,
  29, 29, 30, 31, 31, 32, 33, 34, 34, 35, 36, 37, 37, 38, 39, 40,
  40, 41, 42, 43, 44, 45, 46, 46, 47, 48, 49, 50, 51, 52, 53, 54,
  55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 76, 77, 78, 79, 80, 81, 83, 84, 85, 86, 88, 89,
  90, 91, 93, 94, 95, 96, 98, 99,100,102,103,104,106,107,109,110,
  111,113,114,116,117,119,120,121,123,124,126,128,129,131,132,134,
  135,137,138,140,142,143,145,146,148,150,151,153,155,157,158,160,
  162,163,165,167,169,170,172,174,176,178,179,181,183,185,187,189,
  191,193,194,196,198,200,202,204,206,208,210,212,214,216,218,220,
  222,224,227,229,231,233,235,237,239,241,244,246,248,250,252,255
];

class VoxelProtocol {

  // Packet Header/Identifier Constants for Hardware Discovery - UDP ONLY
  static get DISCOVERY_REQ_PACKET_HEADER() {return DISCOVERY_REQ_PACKET_HEADER;}
  static get DISCOVERY_ACK_PACKET_HEADER() {return DISCOVERY_ACK_PACKET_HEADER;}

  static get WEBSOCKET_PROTOCOL_CONTROLLER() { return WEBSOCKET_PROTOCOL_CONTROLLER; }
  static get WEBSOCKET_PROTOCOL_VIEWER() { return WEBSOCKET_PROTOCOL_VIEWER; }

  static get SERVER_STATE_EVENT_HEADER() {return SERVER_STATE_EVENT_HEADER;}
  static get SERVER_STATE_EVENT_FULL_TYPE() {return SERVER_STATE_EVENT_FULL_TYPE;}
  static get SERVER_STATE_EVENT_SLAVE_TYPE() {return SERVER_STATE_EVENT_SLAVE_TYPE;}

  static get SOUND_EVENT_HEADER() {return SOUND_EVENT_HEADER;}
  static get SOUND_EVENT_LOAD_TYPE() {return SOUND_EVENT_LOAD_TYPE;}
  static get SOUND_EVENT_UNLOAD_TYPE() {return SOUND_EVENT_UNLOAD_TYPE;}
  static get SOUND_EVENT_PLAY_TYPE() {return SOUND_EVENT_PLAY_TYPE;}
  static get SOUND_EVENT_STOP_TYPE() {return SOUND_EVENT_STOP_TYPE;}

  static get VOXEL_DATA_HEADER() {return VOXEL_DATA_HEADER;}
  static get VOXEL_DATA_ALL_TYPE() {return VOXEL_DATA_ALL_TYPE;}

  static get WEBSOCKET_HOST() {return WEBSOCKET_HOST;}
  static get WEBSOCKET_PORT() {return WEBSOCKET_PORT;}

  static get SERVER_TO_CLIENT_WELCOME_HEADER() {return SERVER_TO_CLIENT_WELCOME_HEADER;}
  static get SERVER_TO_CLIENT_SCENE_FRAMEBUFFER_HEADER() {return SERVER_TO_CLIENT_SCENE_FRAMEBUFFER_HEADER;}

  static get FULL_STATE_UPDATE_HEADER() {return FULL_STATE_UPDATE_HEADER;}
  static get VOXEL_ROUTINE_CHANGE_HEADER() {return VOXEL_ROUTINE_CHANGE_HEADER;}
  static get VOXEL_ROUTINE_RESET_HEADER() {return VOXEL_ROUTINE_RESET_HEADER;}
  static get VOXEL_CLEAR_COMMAND_HEADER() {return VOXEL_CLEAR_COMMAND_HEADER;}
  static get AUDIO_INFO_HEADER() {return AUDIO_INFO_HEADER;}
  static get CROSSFADE_UPDATE_HEADER() {return CROSSFADE_UPDATE_HEADER;}
  static get BRIGHTNESS_UPDATE_HEADER() {return BRIGHTNESS_UPDATE_HEADER;}
  static get GAMEPAD_AXIS_HEADER() {return GAMEPAD_AXIS_HEADER;}
  static get GAMEPAD_BUTTON_HEADER() {return GAMEPAD_BUTTON_HEADER;}
  static get GAMEPAD_STATUS_HEADER() {return GAMEPAD_STATUS_HEADER;}

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
      globalBrightness: voxelModel.globalBrightnessMultiplier,
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

  static buildServerStateEventPacketStr(type, eventData) {
    if (!type || !eventData) {
      console.error("Invalid server state event found!");
      return null;
    }
    let packetDataStr = null;
    switch (type) {
      case SERVER_STATE_EVENT_FULL_TYPE:
      case SERVER_STATE_EVENT_SLAVE_TYPE:
        packetDataStr = SERVER_STATE_EVENT_HEADER + type + JSON.stringify(eventData) + ";";
        break;

      default:
        console.error("Invalid server event type, could not construct.");
        break;
    }
    return packetDataStr;
  }
  static buildSoundEventPacketStr(type, soundName, soundSrc, options={}) {
    const packetDataStr = SOUND_EVENT_HEADER + type + JSON.stringify({
      soundSrc, soundName, ...options
    });
    return packetDataStr;
  }

  static buildClientPacketStr(packetType, voxelAnimType, config) {
    THREE.Color.toJSON = () => ({r: this.r, g: this.g, b: this.b});
    return JSON.stringify({
      packetType: packetType,
      voxelAnimType: voxelAnimType,
      config: config,
    });
  }
  static buildClientCrossfadePacketStr(crossfadeTimeInSecs) {
    return JSON.stringify({
      packetType: CROSSFADE_UPDATE_HEADER,
      timeInSecs: crossfadeTimeInSecs,
    });
  }
  static buildClientBrightnessPacketStr(brightness) {
    return JSON.stringify({
      packetType: BRIGHTNESS_UPDATE_HEADER,
      brightness: brightness,
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
  static buildClientGamepadAxisStr(axisEvent) {
    return JSON.stringify({
      packetType: GAMEPAD_AXIS_HEADER,
      axisEvent,
    });
  }
  static buildClientGamepadButtonStr(buttonEvent) {
    return JSON.stringify({
      packetType: GAMEPAD_BUTTON_HEADER,
      buttonEvent,
    });
  }
  static buildClientGamepadStatusStr(statusEvent) {
    return JSON.stringify({
      packetType: GAMEPAD_STATUS_HEADER,
      statusEvent,
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
          console.log("Unspecified configuration or routine change type:");
          console.log(dataObj);
          return false;
        }
        if (!voxelModel.setAnimator(dataObj.voxelAnimType, dataObj.config)) {
          return false;
        }
        //console.log("Animator routine changed.");
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
        voxelModel.clearAll(new THREE.Color(config.r, config.g, config.b));
        break;

      case AUDIO_INFO_HEADER:
        if (voxelModel.currentAnimator && voxelModel.currentAnimator.setAudioInfo) {
          voxelModel.currentAnimator.setAudioInfo(dataObj.audioInfo);
        }
        break;

      case CROSSFADE_UPDATE_HEADER:
        voxelModel.setCrossfadeTime(dataObj.timeInSecs);
        break;
      
      case BRIGHTNESS_UPDATE_HEADER:
        voxelModel.setGlobalBrightness(dataObj.brightness);
        break;

      case GAMEPAD_AXIS_HEADER:
        if (voxelModel.currentAnimator && voxelModel.currentAnimator.onGamepadAxisEvent) {
          voxelModel.currentAnimator.onGamepadAxisEvent(dataObj.axisEvent);
        }
        break;
      case GAMEPAD_BUTTON_HEADER:
        if (voxelModel.currentAnimator && voxelModel.currentAnimator.onGamepadButtonEvent) {
          voxelModel.currentAnimator.onGamepadButtonEvent(dataObj.buttonEvent);
        }
        break;
      case GAMEPAD_STATUS_HEADER:
        if (voxelModel.currentAnimator && voxelModel.currentAnimator.onGamepadStatusEvent) {
          voxelModel.currentAnimator.onGamepadStatusEvent(dataObj.statusEvent);
        }
        break;

      default:
        return false;
    }

    return true;
  }

  
  static stuffVoxelDataAll(startIdx, packetBuf, data, brightnessMultiplier, slaveId = null) {
    let byteCount = startIdx;

    if (slaveId !== null) {
      // For Teensy OctoWS2812 clients...
      const VOXEL_MODULE_Y_SIZE = VoxelConstants.VOXEL_GRID_SIZE;
      const VOXEL_MODULE_Z_SIZE = VoxelConstants.VOXEL_GRID_SIZE;
      const startX = slaveId * NUM_OCTO_DATA_PINS;
      const endX = startX + NUM_OCTO_DATA_PINS;
      const octoVoxels = new Array(NUM_OCTO_DATA_PINS).fill(0);

      // NOTE: THIS CODE'S OPTIMIZATION IS VERY IMPORTANT: IT RUNS FOR EVERY TEENSY FOR EVERY SIMULATED FRAME.
      // IF YOU EXPERIENCE LAG IN THE SIMULATIION THIS IS LIKELY A CULPRIT/BOTTLENECK.
      let octoVoxIdx = 0;
      let b = 0;

      // Go through z-coords first
      for (let z = 0; z < VOXEL_MODULE_Z_SIZE; z++) {
        // ... then y-coords
        for (let y = 0; y < VOXEL_MODULE_Y_SIZE; y++) {

          // We interleave the voxel data by fetching 8 voxels from the cube, each one is from an individual board and corresponds
          // to a different pin on the Teensy's Octo
          octoVoxIdx = 0;
          for (let x = startX; x < endX; x++) { // Always NUM_OCTO_DATA_PINS iterations!
            const voxelColour = data[x][y][z];
            const r = GAMMA_MAP_RGB123[Math.round(brightnessMultiplier*voxelColour[0]*255)];
            const g = GAMMA_MAP_RGB123[Math.round(brightnessMultiplier*voxelColour[1]*255)];
            const b = GAMMA_MAP_RGB123[Math.round(brightnessMultiplier*voxelColour[2]*255)];
            // Store as a hex/int colour as one of the NUM_OCTO_DATA_PINS colour values
            octoVoxels[octoVoxIdx++] = (0xFF0000 & (r << 16)) | (0x00FF00 & (g << 8)) | (0x0000FF & b);
          }

          // Now convert the 8 voxel colour integers to 24 bytes and store it in the packetBuf
          for (let mask = 0x800000; mask !== 0; mask >>= 1) {
            b = 0;
            // We unrolled this loop and removed the if statement because .. optimization? profit?
            //for (let i = 0; i < NUM_OCTO_DATA_PINS; i++) { if ((octoVoxels[i] & mask) !== 0) { b |= (1 << i); } }
            b |= (Number((octoVoxels[0] & mask) !== 0));
            b |= (Number((octoVoxels[1] & mask) !== 0) << 1);
            b |= (Number((octoVoxels[2] & mask) !== 0) << 2);
            b |= (Number((octoVoxels[3] & mask) !== 0) << 3);
            b |= (Number((octoVoxels[4] & mask) !== 0) << 4);
            b |= (Number((octoVoxels[5] & mask) !== 0) << 5);
            b |= (Number((octoVoxels[6] & mask) !== 0) << 6);
            b |= (Number((octoVoxels[7] & mask) !== 0) << 7);
            
            packetBuf[byteCount++] = b;
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
            const voxelColour = data[x][y][z];
            packetBuf[byteCount]   = Math.round(brightnessMultiplier*voxelColour[0]*255);
            packetBuf[byteCount+1] = Math.round(brightnessMultiplier*voxelColour[1]*255);
            packetBuf[byteCount+2] = Math.round(brightnessMultiplier*voxelColour[2]*255);
            byteCount += 3;
          }
        }
      }
    }
    
  }

  // For websocket clients
  static buildVoxelDataPacket(voxelData) {
    if (voxelData === null) {
      return null;
    }
    const {type, data, brightnessMultiplier} = voxelData;
    if (!type || !data) {
      console.log("Invalid voxel data object found!");
      return null;
    }

    let packetDataBuf = null;

    switch (type) {
      case VOXEL_DATA_ALL_TYPE:
        packetDataBuf = new Uint8Array(5 + data.length*data[0].length*data[0][0].length*3); // type (1 byte), subtype (1 byte), frame id (2 bytes), end delimiter (1 byte), and data (3*O(n^3) bytes)
        this.stuffVoxelDataAll(4, packetDataBuf, data, brightnessMultiplier);
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
    const {type, data, brightnessMultiplier} = voxelData;
    if (!type || !data) {
      console.error("Invalid voxel data object found!");
      return null;
    }

    let packetDataBuf = null;

    switch (type) {
      case VOXEL_DATA_ALL_TYPE:
        packetDataBuf = new Uint8Array(4 + NUM_OCTO_DATA_PINS * data[0].length * data[0][0].length * 3); // slaveid (1 byte), type (1 byte), frame id (2 bytes), data (NUM_OCTO_DATA_PINS*size*size*3 bytes)
        this.stuffVoxelDataAll(4, packetDataBuf, data, brightnessMultiplier, slaveId);
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
    //packetDataBuf[packetDataBuf.length-1] = '\n'.charCodeAt(0);

    return Buffer.from(packetDataBuf);
  }

  static readPacketType(packetData) {
    if (typeof packetData === 'string') {
      return packetData.substring(0,1);
    }
    return String.fromCharCode(packetData[0]);
  }
  static readDataType(packetData) {
    if (typeof packetData === 'string') {
      return packetData.substring(1,2);
    }
    return String.fromCharCode(packetData[1]);
  }
  static readFrameId(packetData) {
    if (packetData === 'string') {
      return (parseInt(packetData.substring(2,3)) << 8) + parseInt(packetData.substring(3,4));
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

  static readSoundEvent(packetStr) {
    return JSON.parse(packetStr.substring(SOUND_EVENT_HEADER.length+1, packetStr.length));
  }
};

export default VoxelProtocol;