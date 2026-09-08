import * as THREE from 'three';
import { hashCode } from './MathUtils';
import { GAMMA_MAP_RGB123 } from './Spectrum';
import VoxelConstants from './VoxelConstants';

const NUM_OCTO_DATA_PINS = 8;

const DISCOVERY_REQ_PACKET_HEADER = "REQ";
const DISCOVERY_ACK_PACKET_HEADER = "ACK";

// Protocol identifiers
const WEBSOCKET_PROTOCOL_CONTROLLER = "controller";
const WEBSOCKET_PROTOCOL_VIEWER = "viewer";
const WEBSOCKET_PROTOCOL_MIC = "mic";

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
const DISPLAY_FRAMEBUFFER_SLICE_HEADER = "FB";

const PACKET_END = ";";

// Web Socket Communication Constants
const WEBSOCKET_HOST = "localhost";
const WEBSOCKET_PORT = 4001;

class VoxelProtocol {

  // Packet Header/Identifier Constants for Hardware Discovery - UDP ONLY
  static get DISCOVERY_REQ_PACKET_HEADER() {return DISCOVERY_REQ_PACKET_HEADER;}
  static get DISCOVERY_ACK_PACKET_HEADER() {return DISCOVERY_ACK_PACKET_HEADER;}

  static get WEBSOCKET_PROTOCOL_CONTROLLER() { return WEBSOCKET_PROTOCOL_CONTROLLER; }
  static get WEBSOCKET_PROTOCOL_VIEWER() { return WEBSOCKET_PROTOCOL_VIEWER; }
  static get WEBSOCKET_PROTOCOL_MIC() { return WEBSOCKET_PROTOCOL_MIC; }

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
  static get DISPLAY_FRAMEBUFFER_SLICE_HEADER() {return DISPLAY_FRAMEBUFFER_SLICE_HEADER;}

  static buildWelcomePacketForSlaves(voxelModel) {
    const packetDataBuf = new Uint8Array(3); // slaveid (1 byte), type (1 byte), y-size (1 byte)
    packetDataBuf[0] = 0;
    packetDataBuf[1] = SERVER_TO_CLIENT_WELCOME_HEADER.charCodeAt(0);
    packetDataBuf[2] = voxelModel.ySize();
    return Buffer.from(packetDataBuf);
  }

  static buildClientWelcomePacketStr(voxelModel) {
    const welcomeDataObj = {
      version: VoxelConstants.PROJECT_VERSION,
      gridSize: voxelModel.gridSize,
      currentAnimatorType: voxelModel.currentAnimator ? voxelModel.currentAnimator.getType() : null,
      currentAnimatorConfig: voxelModel.currentAnimator ? voxelModel.currentAnimator.config : null,
      globalBrightness: voxelModel.globalBrightnessMultiplier,
    };
    const gridSizeCharCode = String.fromCharCode(voxelModel.gridSize);
    if (gridSizeCharCode.length !== 1) {
      console.log("ERROR: Grid size is too large!");
    } 

    return SERVER_TO_CLIENT_WELCOME_HEADER + JSON.stringify(welcomeDataObj) + ";";
  }
  static getDataObjFromWelcomePacketStr(packetStr) {
    const welcomeDataObj = JSON.parse(packetStr.substring(SERVER_TO_CLIENT_WELCOME_HEADER.length, packetStr.length-1));
    if (!welcomeDataObj) {
      return null;
    }
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
  static buildClientFramebufferSliceStr(width, height, buffer) {
    return JSON.stringify({
      packetType: DISPLAY_FRAMEBUFFER_SLICE_HEADER,
      width, height, buffer: Array.from(buffer)
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
        // We need to let the client know the full server state,
        // it's asking for a full update to know what's going on in the server, asap
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

      case DISPLAY_FRAMEBUFFER_SLICE_HEADER:
        if (voxelModel.currentAnimator && voxelModel.currentAnimator.updateClientFramebufferSlice) {
          voxelModel.currentAnimator.updateClientFramebufferSlice(dataObj.width, dataObj.height, dataObj.buffer);
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

  static readAndPaintVoxelDataAll(packetDataBuf, voxelDisplay) {
    const gridSize = voxelDisplay.gridSize;
    let currIdx = VOXEL_DATA_HEADER.length + VOXEL_DATA_ALL_TYPE.length + 2; // skip over the: type (1 byte), subtype (1 byte), frame Id (2 bytes)
    if (packetDataBuf.length < currIdx + 3*gridSize*gridSize*gridSize) {
      console.log("Voxel data was invalid (package was not long enough).");
      return -1;
    }

    // The voxel data is everything except the header data and the end delimiter - we can just get a
    // sliced copy of it and inject it directly into the colour attribute buffer of the viewer
    const voxelBuffer = packetDataBuf.slice(currIdx, packetDataBuf.length-1); 
    voxelDisplay.setVoxelBuffer(voxelBuffer);
  }

  static readSoundEvent(packetStr) {
    return JSON.parse(packetStr.substring(SOUND_EVENT_HEADER.length+1, packetStr.length));
  }
};

export default VoxelProtocol;