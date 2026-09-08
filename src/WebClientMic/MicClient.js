import VoxelConstants from '../VoxelConstants';
import VoxelProtocol from "../VoxelProtocol";


class MicClient {
  constructor() {
    this.socket = new WebSocket('ws://' + window.location.hostname + ':' + VoxelProtocol.WEBSOCKET_PORT, VoxelProtocol.WEBSOCKET_PROTOCOL_MIC);
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
          // Check that the version of the server matches the version of the controller
          if (welcomeDataObj.version !== VoxelConstants.PROJECT_VERSION) {
            console.warn(`Mismatching server and controller versions - this may result in strange behaviour or crashes. [Server Version: ${welcomeDataObj.version}, Controller Version: ${VoxelConstants.PROJECT_VERSION}]`);
          }
        }
        break;
    }
  }

  sendAudioInfo(audioInfo) {
    if (this.socket.readyState === WebSocket.OPEN/* && this.socket.bufferedAmount === 0*/) {
      this.socket.send(VoxelProtocol.buildClientPacketStrAudio(audioInfo));
    }
  }

}

export default MicClient;