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

    const logSocketDetails = function(socket) {
      console.log('Socket buffer size: ' + socket.bufferSize);
  
      console.log('---------server details -----------------');
      var address = this.tcpServer.address();
      var port = address.port;
      var ipaddr = address.address;
      console.log('Server is listening at port: ' + port);
      console.log('Server ip: ' + ipaddr);
      var lport = socket.localPort;
      var laddr = socket.localAddress;
      console.log('Server is listening at LOCAL port: ' + lport);
      console.log('Server LOCAL ip: ' + laddr);
  
      console.log('------------remote client info --------------');
      var rport = socket.remotePort;
      var raddr = socket.remoteAddress;
      console.log('REMOTE Socket is listening at port: ' + rport);
      console.log('REMOTE Socket ip: ' + raddr);
  
      console.log('--------------------------------------------')
    }.bind(this);

    // Create the TCP server and set it up
    this.tcpClientSockets = [];
    const tcpServer = net.createServer(function(socket) {
      logSocketDetails(socket);
      socket.setEncoding(DEFAULT_ENCODING);
      this.tcpClientSockets.push(socket);

      socket.on('data', function(data) {
        console.log("Received data from client: " + data.toString());
      });
      socket.on('timeout', function() {
        console.log('Socket timed out.');
        socket.end('Timed out.');
      });
      socket.on('error', function(err) {
        console.log(`Socket error: ${err}`);
      });
      socket.on('end', function() {
        console.log("Client disconnected.");
        this.tcpClientSockets.splice(this.tcpClientSockets.indexOf(socket), 1);
      }.bind(this));

    }.bind(this));

    this.tcpServer = tcpServer;
    this.tcpServer.on('close', function() {
      console.log("TCP server closed.");
    });
    this.tcpServer.on('error', function(error) {
      console.log("TCP server error: " + error);
    });
    this.tcpServer.on('listening', function() {
      const address = tcpServer.address();
      console.log(`TCP server is listening on ${address.address}:${address.port}`);
    });
    //this.tcpServer.maxConnections = 1;

    // Create the UDP socket and set it up
    const udpSocket = udp.createSocket({type: DEFAULT_UDP_SOCKET_TYPE, reuseAddr: true});
    this.udpSocket = udpSocket;
    
    this.udpSocket.on("listening", function() {
      udpSocket.addMembership(DEFAULT_MULTICAST_ADDR);
      udpSocket.setMulticastLoopback(false);
      const address = udpSocket.address();
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

          const tcpServerAddress = tcpServer.address();
          //${tcpServerAddress.address.split(".").join(" ")}

          const ackMessage = Buffer.from(`${VoxelProtocol.DISCOVERY_ACK_PACKET_HEADER} ${senderAddress.split(".").join(" ")} ${senderPort} ${tcpServerAddress.port};`);
          udpSocket.send(ackMessage, 0, ackMessage.length, DEFAULT_UDP_PORT, DEFAULT_MULTICAST_ADDR, function() {
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

      this.webClientSockets.push(socket);

      socket.on('message', function(data) {
        console.log("Websocket message received: " + data);
        VoxelProtocol.readClientPacketStr(data, voxelModel);
      });

      socket.on('close', function() {
        console.log("Websocket closed.");
        this.webClientSockets.splice(this.webClientSockets.indexOf(socket), 1);
      }.bind(this));

      socket.send(VoxelProtocol.buildClientWelcomePacketStr(voxelModel));

    }.bind(this));

    this.webSocketServer.on('close', function() {
      console.log("Websocket server closed.");
    });
  }

  start() {
    this.udpSocket.bind(DEFAULT_UDP_PORT);
    this.tcpServer.listen(DEFAULT_TCP_PORT, '0.0.0.0');
  }

  stop() {
    if (this.tcpWriteIntervalId) {
      clearInterval(this.tcpWriteIntervalId);
    }

    this.udpSocket.close();
    this.tcpServer.close();
  }


  sendClientSocketVoxelData(voxelData) {
    // Go through all of the connected socket (Basic TCP/IP and WebSocket) clients - send voxel data to each
    this.tcpClientSockets.forEach(function(socket) {
      const packetDataStr = VoxelProtocol.buildVoxelDataPacketStr(voxelData);
      socket.write(packetDataStr);
    }.bind(this));

    this.webClientSockets.forEach(function(socket) {
      const packetDataStr = VoxelProtocol.buildVoxelDataPacketStr(voxelData);
      socket.send(packetDataStr);
    }.bind(this));
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
