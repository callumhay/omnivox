import ws from 'ws';
import SerialPort from 'serialport';
import Readline from '@serialport/parser-readline';
import cobs from 'cobs';

import VoxelProtocol from '../VoxelProtocol';
import VoxelConstants from '../VoxelConstants';

const DEFAULT_TEENSY_USB_SERIAL_BAUD = 9600;
const DEFAULT_TEENSY_HW_SERIAL_BAUD  = 3000000;
const SERIAL_POLLING_INTERVAL_MS = 10000;

class VoxelServer {

  constructor(voxelModel) {
    const self = this;
    this.voxelModel = voxelModel;

    // Setup websockets
    this.viewerWS = null;
    this.controllerWS = null;
    this.webSocketServer = new ws.Server({
      port: VoxelProtocol.WEBSOCKET_PORT,
      perMessageDeflate: true, // Enable compression... lots of repetitive data.
    });

    this.webSocketServer.on('open', function() {
      console.log("Websocket server is now running.");
    });

    this.webSocketServer.on('connection', function(socket, request, client) {
      console.log("Websocket opened...");
      switch (socket.protocol) {
        case VoxelProtocol.WEBSOCKET_PROTOCOL_VIEWER:
          console.log("Viewer websocket detected.");
          self.viewerWS = socket;
          break;
        case VoxelProtocol.WEBSOCKET_PROTOCOL_CONTROLLER:
          console.log("Controller websocket detected.");
          self.controllerWS = socket;
          break;
        default:
          console.error("Invalid websocket protocol found: " + socket.protocol);
          socket.destroy("Invalid websocket protocol.");
          return;
      }

      socket.on('message', function(data) {
        //console.log("Websocket message received: " + data);
        VoxelProtocol.readClientPacketStr(data, voxelModel, socket);
      });

      socket.on('close', function() {
        console.log("Websocket closed.");
        if (socket === self.controllerWS) { self.controllerWS = null; }
        else if (socket === self.viewerWS) { self.viewerWS = null; }
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
    const self = this;

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
              //console.log("exploring port: " + availablePort.manufacturer);
              // Check whether we've already opened the port...
              if (self.connectedSerialPorts.filter(item => item.path === availablePort.path).length > 0) {
                //console.log("Already opened port.");
                return;
              }

              // There are two possibilities:
              // 1. USB serial for the teensy, this is used to recieve user messages and debug information.
              // 2. Hardware serial for the teensy, this is used for super fast comm for streaming voxel data.
              let isDebugSerial = availablePort.manufacturer && availablePort.manufacturer.match(/(PJRC|Teensy)/i);
              let isDataSerial  = availablePort.manufacturer && availablePort.manufacturer.match(/(FTDI)/i);
              let newSerialPort = null;
              
              if (isDebugSerial) {
                console.log("Attempting connection with debug/info serial port '" + availablePort.path + "'...");
                newSerialPort = new SerialPort(availablePort.path, {
                  autoOpen: false,
                  baudRate: DEFAULT_TEENSY_USB_SERIAL_BAUD
                });
                newSerialPort.isVoxelDataConnection = false;
              }
              else if (isDataSerial) {
                // Hardware serial
                console.log("Attempting connection with data streaming serial port '" + availablePort.path + "'...");

                newSerialPort = new SerialPort(availablePort.path, {
                  autoOpen: false,
                  baudRate: DEFAULT_TEENSY_HW_SERIAL_BAUD,
                  rtscts: true,
                  highWaterMark: (8*VoxelConstants.VOXEL_GRID_SIZE*VoxelConstants.VOXEL_GRID_SIZE*3+4+64),
                });
                newSerialPort.isVoxelDataConnection = true;
              }

              if (newSerialPort) {
                newSerialPort.on('error', (spErr) => {
                  console.error("Serial port error: " + spErr);
                });

                newSerialPort.on('close', () => {
                  console.log("Serial port closed: " + availablePort.path);
                  delete self.slaveDataMap[availablePort.path];
                  self.connectedSerialPorts.splice(self.connectedSerialPorts.indexOf(newSerialPort), 1);
                });

                newSerialPort.on('open', () => {
                  const parser = new Readline();
                  newSerialPort.pipe(parser);
                  newSerialPort.lastWriteResult = true;

                  if (isDataSerial) {
                    const welcomePacketBuf = VoxelProtocol.buildWelcomePacketForSlaves(self.voxelModel);
                    welcomePacketBuf[0] = 255;
                    newSerialPort.write(cobs.encode(welcomePacketBuf, true));
                    console.log("Sent welcome packet to " + availablePort.path);
                  }
                  
                  parser.on('data', (data) => {
                    if (isDataSerial) {
                      const slaveInfoMatch = data.match(/SLAVE_ID (\d)/);
                      
                      if (slaveInfoMatch) {
                        if (!(availablePort.path in self.slaveDataMap)) {
                          const slaveDataObj = {
                            id: parseInt(slaveInfoMatch[1])
                          };
                          self.slaveDataMap[availablePort.path] = slaveDataObj;
                          //console.log("Parsing match: "); console.log(slaveInfoMatch);
                          //console.log("Parsed slave ID: " + slaveDataObj.id + ", for serial path: " + availablePort.path);
            
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
                    }
                    else {
                      console.log(data);
                      console.log("Current Server Frame#: " + (self.voxelModel.frameCounter % 65536));
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
      //console.log("Number of serial ports connected: " +this.connectedSerialPorts.length);
      // Send data frames out through all connected serial ports
      this.connectedSerialPorts.forEach((currSerialPort) => {
        if (!currSerialPort.isOpen) {
          // Try to reconnect...
          console.log("Serial port (" + currSerialPort.port + ") no longer open, attempting to reconnect...");
          currSerialPort.open();
        }
        else if (currSerialPort.isVoxelDataConnection) {
          const slaveData = this.slaveDataMap[currSerialPort.path];
          if (slaveData && currSerialPort.lastWriteResult) {
            //console.log("Sending slave data for " + currSerialPort.path + ", id: " + slaveData.id);
            const voxelDataSlavePacketBuf = VoxelProtocol.buildVoxelDataPacketForSlaves(voxelData, slaveData.id);
            const encodedPacketBuf = cobs.encode(voxelDataSlavePacketBuf, true);
            currSerialPort.lastWriteResult = currSerialPort.write(encodedPacketBuf);
            currSerialPort.drain((err) => {
              if (err) {  console.error(err); }
              currSerialPort.lastWriteResult = true;
              //console.log("Drained.");
            });
          }
          else {
            //console.log("Failed to send slave data: " + (slaveData ? "" : "Data empty") + " " + (currSerialPort.lastWriteResult ? "" : "Not finished writing."));
          }
        }
      });
    }

    // Send voxel data to the viewer websocket client
    const voxelDataPacketBuf = VoxelProtocol.buildVoxelDataPacket(voxelData);
    if (this.viewerWS && this.viewerWS.bufferedAmount === 0) {
      this.viewerWS.send(voxelDataPacketBuf);
    }
  }

  /**
   * Sets all of the voxel data to the given full set of each voxel in the display.
   * This will result in a full refresh of the display.
   * @param {[][][]} data - A 3D array of the voxel data for display, where each voxel has an RGB colour (getColour() accessor function).
   */
  setVoxelData(data, brightnessMultiplier, frameCounter) {
    this.sendClientSocketVoxelData({
      type: VoxelProtocol.VOXEL_DATA_ALL_TYPE,
      data: data,
      brightnessMultiplier: brightnessMultiplier,
      frameId: frameCounter,
    });
  }
}

export default VoxelServer;
