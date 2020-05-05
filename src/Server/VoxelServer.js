//import udp from 'dgram';
//import net from 'net';
import ws from 'ws';
import SerialPort from 'serialport';
import Readline from '@serialport/parser-readline';
import cobs from 'cobs';

import VoxelProtocol from '../VoxelProtocol';

/*
const DEFAULT_TCP_PORT = 20001;
const DISCOVERY_UDP_PORT = 20000;
const DISCOVERY_MULTICAST_ADDR = "233.255.255.255";
const DATA_UDP_PORT = 20002;
const DATA_MULTICAST_ADDR = "234.255.255.255";

const DEFAULT_UDP_SOCKET_TYPE = "udp4";
const DEFAULT_ENCODING = "utf8";
*/

const DEFAULT_TEENSY_SERIAL_BAUD = 4608000;

class VoxelServer {

  constructor(voxelModel) {
    let self = this;
    this.voxelModel = voxelModel;

    /*
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
      socket.setNoDelay(true);
      //socket.setTimeout(24*60*60*1000); // 24 hours.
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
        //socket.end("Error.");
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

    // Create the UDP discovery socket and set it up
    this.udpSocket = udp.createSocket({type: DEFAULT_UDP_SOCKET_TYPE, reuseAddr: true});
    
    this.udpSocket.on("listening", function() {
      self.udpSocket.addMembership(DISCOVERY_MULTICAST_ADDR);
      self.udpSocket.setMulticastLoopback(false);
      const address = self.udpSocket.address();
      console.log(`UDP socket (discovery) listening on ${address.address}:${address.port}`);
    });

    this.udpSocket.on("message", function(message, rinfo) {
      const senderAddress = rinfo.address;
      const senderPort = rinfo.port;
      console.info(`Received Message from: ${senderAddress}:${senderPort} - ${message}`);

      // If the packet is a request for discovery then we send back an acknowledgement
      const messageHeader = message.toString(DEFAULT_ENCODING, 0, 3);
      switch (messageHeader) {

        case VoxelProtocol.DISCOVERY_REQ_PACKET_HEADER:
          // The request has no data, it's simply a request for acknowledgement from the server for the purposes of discovery.
          // We send back an acknowledgement packet with information about this server.

          const tcpServerAddress = self.tcpServer.address();
          //${tcpServerAddress.address.split(".").join(" ")}

          const ackMessage = Buffer.from(`${VoxelProtocol.DISCOVERY_ACK_PACKET_HEADER} ${senderAddress.split(".").join(" ")} ${senderPort} ${tcpServerAddress.port};`);
          self.udpSocket.send(ackMessage, 0, ackMessage.length, DISCOVERY_UDP_PORT, DISCOVERY_MULTICAST_ADDR, function() {
            console.info(`Sending ${VoxelProtocol.DISCOVERY_ACK_PACKET_HEADER} message: "${ackMessage}"`);
          });
          break;

        default:
          break;
      }
    });
    */
    
    // Setup websockets
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
        //console.log("Websocket message received.");
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

    this.availableSerialPorts = [];
    this.connectedSerialPorts = [];
    this.slaveDataMap = {};
  }

  start() {
    //this.udpSocket.bind(DISCOVERY_UDP_PORT);
    //this.tcpServer.listen(DEFAULT_TCP_PORT, '0.0.0.0');
    
    let self = this;
    const parser = new Readline();

    SerialPort.list().then(
      ports => {
        self.availableSerialPorts = ports;

        console.log("Available serial ports:");
        self.availableSerialPorts.forEach((availablePort) => {
          console.log(availablePort);
        });
        
        // Attempt to connect to each of the serial ports that might be teensies...
        self.availableSerialPorts.forEach((availablePort) => {
          if (availablePort.manufacturer.match(/PJRC/i)) {
            console.log("Attempting connection with port '" + availablePort.path + "'...");
            const newSerialPort = new SerialPort(availablePort.path, {
              autoOpen: false,
              baudRate: DEFAULT_TEENSY_SERIAL_BAUD
            });

            newSerialPort.on('error', (spErr) => {
              console.error("Serial port error: " + spErr);
            });

            newSerialPort.on('close', () => {
              console.log("Serial port closed: " + availablePort.path);
              delete self.slaveDataMap[availablePort.path];
              self.connectedSerialPorts.splice(self.connectedSerialPorts.indexOf(newSerialPort), 1);
            });

            newSerialPort.on('open', () => {
              newSerialPort.pipe(parser);
              parser.on('data', (data) => {
                const slaveInfoMatch = data.match(/SLAVE_ID (\d)/);
                if (slaveInfoMatch) {
      
                  if (!(availablePort.path in self.slaveDataMap)) {
                    const slaveDataObj = {
                      id: parseInt(slaveInfoMatch[1])
                    };
                    self.slaveDataMap[availablePort.path] = slaveDataObj;
      
                    // First time getting information from the current serial port, send a welcome packet
                    console.log("Slave ID at " + availablePort.path + " = " + self.slaveDataMap[availablePort.path].id);
                    console.log("Sending welcome packet to " + availablePort.path + "...");
      
                    const welcomePacketBuf = VoxelProtocol.buildWelcomePacketForSlaves(self.voxelModel);
                    welcomePacketBuf[0] = slaveDataObj.id;
                    newSerialPort.write(cobs.encode(welcomePacketBuf, true));
                  }
                  else {
                    self.slaveDataMap[availablePort.path].id = parseInt(slaveInfoMatch[1]);
                  }
                }
                else {
                  console.log(data);
                }
              });
              self.connectedSerialPorts.push(newSerialPort);
            });

            // Open the serial port
            newSerialPort.open((err) => {
              if (err) {
                console.error("Failed to open serial port '" + availablePort.path + "': " + err);
              }
              else {
                console.log("Now connected to port '" + newSerialPort.path + "' @" + newSerialPort.baudRate + " baud");
              }
            });
          }
        });
      },
      err => console.error(err)
    );
    
  }

  stop() {
    //this.udpSocket.close();
    //this.tcpServer.close();
    this.connectedSerialPorts.forEach((currSerialPort) => {
      currSerialPort.close();
    });
  }

  sendClientSocketVoxelData(voxelData) {
    
    if (this.connectedSerialPorts.length > 0) {
      const voxelDataSlavePacketBuf = VoxelProtocol.buildVoxelDataPacketForSlaves(voxelData);
      
      // Send data frames out through all connected serial ports
      this.connectedSerialPorts.forEach((currSerialPort) => {
        if (!currSerialPort.isOpen) {
          // Try to reconnect...
          console.log("Serial port (" + currSerialPort.port + ") no longer open, attempting to reconnect...");
          currSerialPort.open();
        }
        else {
          const slaveData = this.slaveDataMap[currSerialPort.path];

          if (slaveData) {
            voxelDataSlavePacketBuf[0] = slaveData.id;
            const encodedPacketBuf = cobs.encode(voxelDataSlavePacketBuf, true);

            slaveData.writingToSerial = true;
            currSerialPort.write(encodedPacketBuf);
            currSerialPort.drain((err) => {
              if (err) { 
                console.error(err);
              }
            });
          }
        }
      });
    }

    /*
    // Send data frames out through UDP multicast
    this.udpSocket.send(voxelDataPacketBuf, 0, voxelDataPacketBuf.length, DATA_UDP_PORT, DATA_MULTICAST_ADDR, function() {
      console.info(`Sending voxel data`);
    });
    // Send voxel data to regular TCP clients
    for (let i = 0; i < this.tcpClientSockets.length; i++) {
      const socket = this.tcpClientSockets[i];
      if (socket.writable && socket.bufferSize === 0) {
        socket.write(voxelDataPacketBuf);
      }
    }
    */

    // Send voxel data to websocket clients
    const voxelDataPacketBuf = VoxelProtocol.buildVoxelDataPacket(voxelData);
    this.webClientSockets.forEach(function(socket) {
      socket.send(voxelDataPacketBuf);
    });
  }

  /**
   * Sets all of the voxel data to the given full set of each voxel in the display.
   * This will result in a full refresh of the display.
   * @param {[][][]} data - A 3D array of the voxel data for display, where each voxel has an RGB colour (getColour() accessor function).
   */
  setVoxelData(data, frameCounter) {
    this.sendClientSocketVoxelData({
      type: VoxelProtocol.VOXEL_DATA_ALL_TYPE,
      data: data,
      frameId: frameCounter,
    });
  }
  /**
   * Tells the display to clear to the given colour.
   * @param {THREE.Color} clearColour - The colour that will be set for each voxel in the display. 
   */
  setClearVoxelData(clearColour, frameCounter) {
    this.sendClientSocketVoxelData({
      type: VoxelProtocol.VOXEL_DATA_CLEAR_TYPE,
      data: clearColour,
      frameId: frameCounter
    });
  }
  setDiffVoxelData(diffVoxelData) {
    // TODO
  }
}

export default VoxelServer;
