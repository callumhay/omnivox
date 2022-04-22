import VoxelProtocol from "../VoxelProtocol";

const FRAMES_OUT_OF_SEQUENCE_BEFORE_RESET = 30;

class DisplayClient {
  constructor(voxelDisplay) {
    this.voxelDisplay = voxelDisplay;
    this.socket = new WebSocket('ws://' + window.location.hostname + ':' + VoxelProtocol.WEBSOCKET_PORT, VoxelProtocol.WEBSOCKET_PROTOCOL_VIEWER);
    this.lastFrameId = 0;
    this.consecutiveFramesOutofSequence = 0;
    this.lastFrameHashCode = -1;
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
          const {gridSize} = welcomeDataObj;
          if (gridSize !== undefined && gridSize !== this.voxelDisplay.gridSize) {
            console.log("Resizing the voxel grid.");
            this.voxelDisplay.rebuild(parseInt(gridSize));
          }
          this.lastFrameId = 0; // Reset the frame Id
        }
        break;
        
      case VoxelProtocol.VOXEL_DATA_HEADER:
        const voxelDataType = VoxelProtocol.readVoxelDataType(messageData);
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
            //console.log("Recieved frame");
            this.lastFrameHashCode = VoxelProtocol.readAndPaintVoxelDataAll(messageData, this.voxelDisplay, this.lastFrameHashCode);
            if (this.lastFrameHashCode === -1) {
              console.log("Invalid voxel (all) data.");
            }
            break;
          
          default:
            console.log("Unimplemented protocol voxel data type: " + voxelDataType);
            break;
        }

        this.lastFrameId = packetFrameId;
        break;
      
      case VoxelProtocol.SERVER_STATE_EVENT_HEADER:
        break;
      case VoxelProtocol.SPECIAL_EVENT_HEADER:
        break;

      default:
        console.log("Invalid packet type: " + packetType);
        break;
    }
  }
}

export default DisplayClient;