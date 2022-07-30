import VoxelConstants from "../VoxelConstants";
import VoxelProtocol from "../VoxelProtocol";

const FRAMES_OUT_OF_SEQUENCE_BEFORE_RESET = 30;

class ViewerClient {
  constructor(voxelDisplay, soundPlayer) {
    this.voxelDisplay = voxelDisplay;
    this.soundPlayer  = soundPlayer;
    this.socket = new WebSocket('ws://' + window.location.hostname + ':' + VoxelProtocol.WEBSOCKET_PORT, VoxelProtocol.WEBSOCKET_PROTOCOL_VIEWER);
    this.lastFrameId = 0;
    this.consecutiveFramesOutofSequence = 0;
  }

  start() {
    this.socket.addEventListener('open', (event) => {
      console.log("Websocket open on " + event.currentTarget.url);
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
          // Check that the version of the server matches the version of the viewer
          if (welcomeDataObj.version !== VoxelConstants.PROJECT_VERSION) {
            console.warn(`Mismatching server and viewer versions - this may result in strange behaviour or crashes. [Server Version: ${welcomeDataObj.version}, Viewer Version: ${VoxelConstants.PROJECT_VERSION}]`);
          }
          const {gridSize} = welcomeDataObj;
          if (gridSize !== undefined && gridSize !== this.voxelDisplay.gridSize) {
            console.log("Resizing the voxel grid.");
            this.voxelDisplay.rebuild(parseInt(gridSize));
          }
          this.lastFrameId = 0; // Reset the frame Id
        }
        break;
        
      case VoxelProtocol.VOXEL_DATA_HEADER:
        const voxelDataType = VoxelProtocol.readDataType(messageData);
        const packetFrameId = VoxelProtocol.readFrameId(messageData);

        if (packetFrameId > 256 && this.lastFrameId >= packetFrameId) {
          console.log("Frame Ids out of sequence, not updating.");
          this.consecutiveFramesOutofSequence++;
          if (this.consecutiveFramesOutofSequence < FRAMES_OUT_OF_SEQUENCE_BEFORE_RESET) {
            return;
          }
        }
        this.consecutiveFramesOutofSequence = 0;

        switch (voxelDataType) {
          
          case VoxelProtocol.VOXEL_DATA_ALL_TYPE:
            VoxelProtocol.readAndPaintVoxelDataAll(messageData, this.voxelDisplay);
            break;
          
          default:
            console.error("Unimplemented protocol voxel data type: " + voxelDataType);
            break;
        }

        this.lastFrameId = packetFrameId;
        break;
      
      case VoxelProtocol.SERVER_STATE_EVENT_HEADER: {
        const eventType = VoxelProtocol.readDataType(messageData);
        switch(eventType) {
          case VoxelProtocol.SERVER_STATE_EVENT_FULL_TYPE:
            break;
          case VoxelProtocol.SERVER_STATE_EVENT_SLAVE_TYPE:
            break;
          default:
            console.error("Unimplemented server state event type: " + eventType);
            break;
        }
        break;
      }

      case VoxelProtocol.SOUND_EVENT_HEADER: {
        const eventType  = VoxelProtocol.readDataType(messageData);
        const soundEvent = VoxelProtocol.readSoundEvent(messageData);
        switch(eventType) {
          case VoxelProtocol.SOUND_EVENT_LOAD_TYPE:
            this.soundPlayer.preloadSound(soundEvent);
            break;
          case VoxelProtocol.SOUND_EVENT_UNLOAD_TYPE:
            this.soundPlayer.unloadSound(soundEvent);
            break;
          case VoxelProtocol.SOUND_EVENT_PLAY_TYPE:
            this.soundPlayer.playSound(soundEvent);
            break;
          case VoxelProtocol.SOUND_EVENT_STOP_TYPE:
            this.soundPlayer.stopSound(soundEvent);
            break;
          default:
            console.error("Unimplemented sound event type: " + eventType);
            break;
        }
        break;
      }

      default:
        console.error("Invalid packet type: " + packetType);
        break;
    }
  }
}

export default ViewerClient;
