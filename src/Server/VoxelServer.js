import udp from 'dgram';
import net from 'net';
import ws from 'ws';

import VoxelProtocol from '../VoxelProtocol';

const DEFAULT_TCP_PORT = 20001;
const DEFAULT_UDP_PORT = 20000;
const DEFAULT_MULTICAST_ADDR = "233.255.255.255";

const DEFAULT_UDP_SOCKET_TYPE = "udp4";
const DEFAULT_ENCODING = "utf8";

class VoxelServer {

  constructor(voxelModel) {
    let self = this;
    
    const logSocketDetails = function(socket) {
      console.log('Socket buffer size: ' + socket.bufferSize);
  
      console.log('---------server details -----------------');
      const address = self.tcpServer.address();
      const port = address.port;
      const ipaddr = address.address;
      console.log('Server is listening at port: ' + port);
      console.log('Server ip: ' + ipaddr);
      const lport = socket.localPort;
      const laddr = socket.localAddress;
      console.log('Server is listening at LOCAL port: ' + lport);
      console.log('Server LOCAL ip: ' + laddr);
  
      console.log('------------remote client info --------------');
      const rport = socket.remotePort;
      const raddr = socket.remoteAddress;
      console.log('REMOTE Socket is listening at port: ' + rport);
      console.log('REMOTE Socket ip: ' + raddr);
  
      console.log('--------------------------------------------')
    };

    // Create the TCP server and set it up
    this.tcpClientSockets = [];
    this.tcpServer = net.createServer();

    this.tcpServer.on('connection', function(socket) {
      logSocketDetails(socket);
      socket.setEncoding(DEFAULT_ENCODING);
      socket.setTimeout(10*60*1000); // 10 minutes.
      self.tcpClientSockets.push(socket);

      socket.on('data', function(data) {
        console.log("Received data from client: " + data.toString());
      });
      socket.on('timeout', function() {
        console.log('Socket timed out.');
        socket.end('Timed out.');
      });
      socket.on('error', function(err) {
        console.log(`Socket error: ${err}`);
        self.tcpClientSockets.splice(self.tcpClientSockets.indexOf(socket), 1);
      });
      socket.on('end', function() {
        console.log("Client disconnected.");
        self.tcpClientSockets.splice(self.tcpClientSockets.indexOf(socket), 1);
      });

      socket.write(VoxelProtocol.buildClientWelcomePacketStr(voxelModel));
    });
    this.tcpServer.on('close', function() {
      console.log("TCP server closed.");
    });
    this.tcpServer.on('error', function(error) {
      console.log("TCP server error: " + error);
    });
    this.tcpServer.on('listening', function() {
      const address = self.tcpServer.address();
      console.log(`TCP server is listening on ${address.address}:${address.port}`);
    });

    // Create the UDP socket and set it up
    this.udpSocket = udp.createSocket({type: DEFAULT_UDP_SOCKET_TYPE, reuseAddr: true});
    
    this.udpSocket.on("listening", function() {
      self.udpSocket.addMembership(DEFAULT_MULTICAST_ADDR);
      self.udpSocket.setMulticastLoopback(false);
      const address = self.udpSocket.address();
      console.log(`UDP socket listening on ${address.address}:${address.port}`);
    });

    this.udpSocket.on("message", function(message, rinfo) {
      const senderAddress = rinfo.address;
      const senderPort = rinfo.port;
      console.info(`Received Message from: ${rinfo.address}:${rinfo.port} - ${message}`);

      // If the packet is a request for discovery then we send back an acknowledgement
      const messageHeader = message.toString(DEFAULT_ENCODING, 0, 3);
      switch (messageHeader) {

        case VoxelProtocol.DISCOVERY_REQ_PACKET_HEADER:
          // The request has no data, it's simply a request for acknowledgement from the server for the purposes of discovery.
          // We send back an acknowledgement packet with information about this server.

          const tcpServerAddress = self.tcpServer.address();
          //${tcpServerAddress.address.split(".").join(" ")}

          const ackMessage = Buffer.from(`${VoxelProtocol.DISCOVERY_ACK_PACKET_HEADER} ${senderAddress.split(".").join(" ")} ${senderPort} ${tcpServerAddress.port};`);
          self.udpSocket.send(ackMessage, 0, ackMessage.length, DEFAULT_UDP_PORT, DEFAULT_MULTICAST_ADDR, function() {
            console.info(`Sending ${VoxelProtocol.DISCOVERY_ACK_PACKET_HEADER} message: "${ackMessage}"`);
          });
          break;

        default:
          break;
      }
    });

    this.webClientSockets = [];
    this.webSocketServer = new ws.Server({
      port: VoxelProtocol.WEBSOCKET_PORT,
      perMessageDeflate: false,
    });

    this.webSocketServer.on('open', function() {
      console.log("Websocket server is now running.");
    });

    this.webSocketServer.on('connection', function(socket, request, client) {
      console.log("Websocket opened.");

      self.webClientSockets.push(socket);

      socket.on('message', function(data) {
        console.log("Websocket message received.");
        VoxelProtocol.readClientPacketStr(data, voxelModel);
      });

      socket.on('close', function() {
        console.log("Websocket closed.");
        self.webClientSockets.splice(self.webClientSockets.indexOf(socket), 1);
      });

      socket.send(VoxelProtocol.buildClientWelcomePacketStr(voxelModel));

    });

    this.webSocketServer.on('close', function() {
      console.log("Websocket server closed.");
    });
  }

  start() {
    this.udpSocket.bind(DEFAULT_UDP_PORT);
    this.tcpServer.listen(DEFAULT_TCP_PORT, '0.0.0.0');
  }

  stop() {
    this.udpSocket.close();
    this.tcpServer.close();
  }

  sendClientSocketVoxelData(voxelData) {
    // Go through all of the connected socket (Basic TCP/IP and WebSocket) clients - send voxel data to each
    for (let i = 0; i < this.tcpClientSockets.length; i++) {
      const socket = this.tcpClientSockets[i];
      //console.log("Socket buffer size: " + socket.bufferSize);
      if (socket.writable && socket.bufferSize === 0) {
        socket.write(VoxelProtocol.buildVoxelDataPacketStr(voxelData));
      }
    }

    this.webClientSockets.forEach(function(socket) {
      socket.send(VoxelProtocol.buildVoxelDataPacketStr(voxelData));
    });
  }

  /**
   * Sets all of the voxel data to the given full set of each voxel in the display.
   * This will result in a full refresh of the display.
   * @param {[][][]} data - A 3D array of the voxel data for display, where each voxel has an RGB colour (getColour() accessor function).
   */
  setVoxelData(data) {
    this.sendClientSocketVoxelData({
      type: VoxelProtocol.VOXEL_DATA_ALL_TYPE,
      data: data
    });
  }
  /**
   * Tells the display to clear to the given colour.
   * @param {THREE.Color} clearColour - The colour that will be set for each voxel in the display. 
   */
  setClearVoxelData(clearColour) {
    this.sendClientSocketVoxelData({
      type: VoxelProtocol.VOXEL_DATA_CLEAR_TYPE,
      data: clearColour
    });
  }
  setDiffVoxelData(diffVoxelData) {
    // TODO
  }
}

export default VoxelServer;
