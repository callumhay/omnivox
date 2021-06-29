import VoxelProtocol from "../VoxelProtocol";
import MasterCP from './ControlPanels/MasterCP';

class ControllerClient {

  constructor(soundManager) {
    this.socket = new WebSocket('ws://' + VoxelProtocol.WEBSOCKET_HOST + ':' + VoxelProtocol.WEBSOCKET_PORT, VoxelProtocol.WEBSOCKET_PROTOCOL_CONTROLLER);
    this.soundManager = soundManager;
    this.controlPanel = null;
    this.commEnabled = false;
  }

  start() {
    this.socket.addEventListener('open', (event) => {
      console.log("Websocket open on " + event.currentTarget.url);
      // TODO: Send a request to take this client off the full voxel frame notifications
    });
    this.socket.addEventListener('error', (error) => {
      console.log("Websocket error: " + error);
    });
    this.socket.addEventListener('close', (event) => {
      console.log("Websocket closed.");
    });

    // Receiving messages from the Voxel Server
    this.socket.addEventListener('message', ((event) => {

      if (typeof event.data === 'string') {
        this.readPacket(event.data);
      }
      else {
        const reader = new FileReader();
        reader.addEventListener('loadend', () => {
          const messageData = new Uint8Array(reader.result);
          this.readPacket(messageData);
        });

        reader.readAsArrayBuffer(event.data);
      }

    }).bind(this));
  }

  readPacket(messageData) {
    const packetType = VoxelProtocol.readPacketType(messageData);
    switch (packetType) {

      case VoxelProtocol.SERVER_TO_CLIENT_WELCOME_HEADER:
        const welcomeDataObj = VoxelProtocol.getDataObjFromWelcomePacketStr(messageData);
        if (welcomeDataObj) {
          const {gridSize, currentAnimatorType, currentAnimatorConfig, globalBrightness} = welcomeDataObj;

          if (gridSize !== undefined && (!this.controlPanel || this.controlPanel.gridSize !== gridSize)) {
            console.log("Initializing Controls.");
            // Disable communication with the server while we (re)initialize the interface
            // otherwise we get a bunch of garbage requests going out from the controller while it initializes
            this.commEnabled  = false;
            if (this.controlPanel) { this.controlPanel.dispose(); }
            this.controlPanel = new MasterCP(gridSize, this, this.soundManager);
            this.commEnabled  = true;
          }

          if (this.controlPanel) {
            if (currentAnimatorType && currentAnimatorConfig) {
              this.controlPanel.updateAnimator(currentAnimatorType, currentAnimatorConfig);
            }
            if (globalBrightness) {
              this.controlPanel.updateBrightness(globalBrightness);
            }
          }
        }
        break;
        
      case VoxelProtocol.VOXEL_DATA_HEADER:
        // Ignore voxel data, that's not what the controller is for.
        console.error("Controller should not be receieving full voxel data!");
        break;

      default:
        console.log("Invalid packet type: " + packetType);
        break;
    }
  }

  sendRequestFullStateUpdate() {
    if (this.socket.readyState === WebSocket.OPEN && this.commEnabled) {
      //console.log("sendRequestFullStateUpdate");
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.FULL_STATE_UPDATE_HEADER, null, null));
    }
  }
  sendAnimatorChangeCommand(animatorType, config) {
    if (this.socket.readyState === WebSocket.OPEN && this.commEnabled) {
      //console.log("sendAnimatorChangeCommand: " + animatorType);
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_ROUTINE_CHANGE_HEADER, animatorType, config));
    }
  }
  sendConfigUpdateCommand(config) {
    if (this.socket.readyState === WebSocket.OPEN && this.commEnabled) {
      //console.log("sendConfigUpdateCommand");
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_ROUTINE_CONFIG_UPDATE_HEADER, null, config));
    }
  }
  sendRoutineResetCommand() {
    if (this.socket.readyState === WebSocket.OPEN && this.commEnabled) {
      //console.log("sendRoutineResetCommand");
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_ROUTINE_RESET_HEADER, null, null));
    }
  }
  sendClearCommand(r, g, b) {
    if (this.socket.readyState === WebSocket.OPEN && this.commEnabled) {
      //console.log("sendClearCommand");
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_CLEAR_COMMAND_HEADER, null, {r: r, g: g, b: b}));
    }
  }
  sendAudioInfo(audioInfo) {
    if (this.socket.bufferedAmount === 0 && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(VoxelProtocol.buildClientPacketStrAudio(audioInfo));
    }
  }
  sendCrossfadeTime(crossfadeTimeInSecs) {
    if (this.socket.readyState === WebSocket.OPEN && this.commEnabled) {
      //console.log("sendCrossfadeTime");
      this.socket.send(VoxelProtocol.buildClientCrossfadePacketStr(crossfadeTimeInSecs));
    }
  }
  sendGlobalBrightness(brightness) {
    if (this.socket.readyState === WebSocket.OPEN && this.commEnabled) {
      this.socket.send(VoxelProtocol.buildClientBrightnessPacketStr(brightness));
    }
  }
  
}

export default ControllerClient;