import udp from 'dgram';
import net from 'net';

const DEFAULT_TCP_PORT = 20001;
const DEFAULT_UDP_PORT = 20000;
const DEFAULT_MULTICAST_ADDR = "233.255.255.255";

const DEFAULT_UDP_SOCKET_TYPE = "udp4";
const DEFAULT_ENCODING = "utf8";

const DEFAULT_POLLING_FREQUENCY_HZ = 2*60 + 1;
const DEFAULT_POLLING_INTERVAL_MS  = 1000 / DEFAULT_POLLING_FREQUENCY_HZ;

// Packet Header/Identifier Constants
const DISCOVERY_REQ_PACKET_HEADER = "REQ";
const DISCOVERY_ACK_PACKET_HEADER = "ACK";

const VOXEL_DATA_HEADER = "DAT";

const VOXEL_DATA_ALL_TYPE   = "ALL";
const VOXEL_DATA_DIFF_TYPE  = "DIF";
const VOXEL_DATA_CLEAR_TYPE = "CLR";

class VoxelServer {

  constructor() {
    this.voxelData = null; // Object holding all changed voxel data on it

    const logSocketDetails = function(socket) {
      console.log('Socket buffer size: ' + socket.bufferSize);
  
      console.log('---------server details -----------------');
      var address = server.address();
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
    };

    // Create the TCP server and set it up
    const tcpServer = net.createServer();
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

    this.tcpServer.on('connection', function(tcpSocket) {
      logSocketDetails(tcpSocket);

      tcpSocket.setEncoding(DEFAULT_ENCODING);

      const tcpWriteIntervalId = setInterval(function(socket) {
        // Put together a packet to send to the client of the current state of the voxel display
        if (this.voxelData !== null) {

          const {type, data} = this.voxelData;
          if (!type || !data) {
            console.log("Invalid voxel data object found!");
            this.voxelData = null;
            return;
          }
          
          let packetDataStr = `${VOXEL_DATA_HEADER}|${type}`;
          switch (type) {

            case VOXEL_DATA_ALL_TYPE:
              const xLen = data.length;
              for (let x = 0; x < xLen; x++) {
                const yLen = data[x].length;
                for (let y = 0; y < yLen; y++) {
                  const zLen = data[x][y].length;
                  for (let z = 0; z < zLen; z++) {
                    const voxel = data[x][y][z];
                    const voxelColour = voxel.getColour();
                    packetDataStr += `${voxelColour.r},${voxelColour.g},${voxelColour.b};`;
                  }
                }
              }
              break;

            case VOXEL_DATA_CLEAR_TYPE:
              packetDataStr += `${data.r},${data.g},${data.b};`;
              break;

            case VOXEL_DATA_DIFF_TYPE:
              // TODO
              break;

            default:
              this.voxelData = null;
              return;
          }

          socket.write(packetDataStr);
          this.voxelData = null;
        }
      }, DEFAULT_POLLING_INTERVAL_MS, tcpSocket);

      tcpSocket.on('data', function(data) {
        console.log("Received data from client: " + data.toString());
      });

      tcpSocket.on('end', function() {
        console.log("Client disconnected.");
        clearInterval(tcpWriteIntervalId);
      });
      
      tcpSocket.on('timeout', function() {
        console.log('Socket timed out.');
        tcpSocket.end('Timed out.');
      });

      tcpSocket.on('error', function(err) {
        console.log(`Socket error: ${err}`);
      });

    });

    this.tcpServer.maxConnections = 1;

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

        case DISCOVERY_REQ_PACKET_HEADER:
          // The request has no data, it's simply a request for acknowledgement from the server for the purposes of discovery.
          // We send back an acknowledgement packet with information about this server.
          const tcpServerAddress = tcpServer.address();
          const ackMessage = Buffer.from(`${DISCOVERY_ACK_PACKET_HEADER} ${senderAddress.split('.').join(" ")} ${senderPort} ${tcpServerAddress.address} ${tcpServerAddress.port}`);
          udpSocket.send(ackMessage, 0, ackMessage.length, DEFAULT_UDP_PORT, DEFAULT_MULTICAST_ADDR, function() {
            console.info(`Sending ${DISCOVERY_ACK_PACKET_HEADER} message: "${ackMessage}"`);
          });
          break;

        default:
          break;
      }
      
    });

  }

  start() {
    this.udpSocket.bind(DEFAULT_UDP_PORT);
    this.tcpServer.listen(DEFAULT_TCP_PORT, 'localhost');
  }
  stop() {
    this.udpSocket.close();
    this.tcpServer.close();
  }

  /**
   * Sets all of the voxel data to the given full set of each voxel in the display.
   * This will result in a full refresh of the display.
   * @param {[][][]} data - A 3D array of the voxel data for display, where each voxel has an RGB colour (getColour() accessor function).
   */
  setVoxelData(data) {
    this.voxelData = {
      type: VOXEL_DATA_ALL_TYPE,
      data: data
    };
  }
  /**
   * Tells the display to clear to the given colour.
   * @param {THREE.Color} clearColour - The colour that will be set for each voxel in the display. 
   */
  setClearVoxelData(clearColour) {
    this.voxelData = {
      type: VOXEL_DATA_CLEAR_TYPE,
      data: clearColour
    };
  }
  setDiffVoxelData(diffVoxelData) {
    // TODO
  }
}

export default VoxelServer;
