import ws from 'ws';
import SerialPort from 'serialport';
import Readline from '@serialport/parser-readline';
import cobs from 'cobs';

import VoxelProtocol from '../VoxelProtocol';

const DEFAULT_TEENSY_SERIAL_BAUD = 4608000;
const SERIAL_POLLING_INTERVAL_MS = 10000;

class VoxelServer {

  constructor(voxelModel) {
    let self = this;
    this.voxelModel = voxelModel;

    // Setup websockets
    this.webClientSockets = [];
    this.webSocketServer = new ws.Server({
      port: VoxelProtocol.WEBSOCKET_PORT,
      perMessageDeflate: true, // Enable compression... lots of repetitive data.
    });

    this.webSocketServer.on('open', function() {
      console.log("Websocket server is now running.");
    });

    this.webSocketServer.on('connection', function(socket, request, client) {
      console.log("Websocket opened.");

      self.webClientSockets.push(socket);

      socket.on('message', function(data) {
        //console.log("Websocket message received.");
        VoxelProtocol.readClientPacketStr(data, voxelModel, socket);
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
    let self = this;
    const parser = new Readline();

    setInterval(function() {

      SerialPort.list().then(
        ports => {
          self.availableSerialPorts = ports;
          //console.log("Available serial ports:");
          //self.availableSerialPorts.forEach((availablePort) => {
          //  console.log(availablePort);
          //});
          
          // Attempt to connect to each of the serial ports that might be teensies...
          try {
            self.availableSerialPorts.forEach((availablePort) => {
              
              // Check whether we've already opened the port...
              if (self.connectedSerialPorts.filter(item => item.path === availablePort.path).length > 0) {
                return;
              }

              if (availablePort.manufacturer instanceof String && availablePort.manufacturer.match(/PJRC/i)) {
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
          }
          catch (err) {
            console.error(err);
          }
        },
        err => {
          console.error(err);
        }
      );
    }, SERIAL_POLLING_INTERVAL_MS);
  }

  stop() {
    this.connectedSerialPorts.forEach((currSerialPort) => {
      currSerialPort.close();
    });
  }

  sendClientSocketVoxelData(voxelData) {
    
    if (this.connectedSerialPorts.length > 0) {
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
            const voxelDataSlavePacketBuf = VoxelProtocol.buildVoxelDataPacketForSlaves(voxelData, slaveData.id);
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
}

export default VoxelServer;
