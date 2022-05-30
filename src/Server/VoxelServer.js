import ws from 'ws';
import {SerialPort} from 'serialport';
import {ReadlineParser} from '@serialport/parser-readline';
import cobs from 'cobs';

import VoxelProtocol from '../VoxelProtocol';
import VoxelConstants from '../VoxelConstants';

const DEFAULT_TEENSY_USB_SERIAL_BAUD = 9600;
const DEFAULT_TEENSY_HW_SERIAL_BAUD  = 3000000;
const SERIAL_POLLING_INTERVAL_MS     = 5000;

class VoxelServer {

  constructor(voxelModel) {
    const self = this;
    this.voxelModel = voxelModel;

    // Setup websockets
    this.viewerWebSocks = [];
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
          console.log(VoxelConstants.PROJECT_NAME + " Viewer detected.");
          self.viewerWebSocks.push(socket);
          break;
        case VoxelProtocol.WEBSOCKET_PROTOCOL_CONTROLLER:
          console.log(VoxelConstants.PROJECT_NAME + " Controller detected.");
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
        else {
          const idx = self.viewerWebSocks.indexOf(socket);
          if (idx > -1) { self.viewerWebSocks.splice(idx, 1); }
        }
      });

      socket.send(VoxelProtocol.buildClientWelcomePacketStr(voxelModel));
    });

    this.webSocketServer.on('close', function() {
      console.log("Websocket server closed.");
    });

    this.connectedSerialPorts = [];
    this.slaveDataMap = {};
  }

  start() {
    const self = this;

    const serialPoll = function() {
      //console.log("Number of connected ports: " + self.connectedSerialPorts.length);

      // Max 4 serial connections, no need to keep polling for serial ports if they're all connected.
      // NOTE: The connectedSerialPorts array will get smaller when serial connections are dropped, 
      // this will then fall through and reinitialize new connections again
      if (self.connectedSerialPorts.length >= 4) { return; }

      SerialPort.list().then(
        ports => {
          //console.log("Available serial ports:");
          //ports.forEach((availablePort) => {
          //  console.log(availablePort);
          //});

          // Attempt to connect to each of the serial ports...
          try {
            for (const availablePort of ports) {
              //console.log("exploring port: " + availablePort.manufacturer);

              // Check whether we've already opened this port...
              if (self.connectedSerialPorts.filter(item => item.path === availablePort.path).length > 0) { continue; }

              // There are two possibilities:
              // - USB serial for the teensy, this is used to recieve user messages and debug information.
              // - Hardware serial for the teensy, this is used for fast comm for streaming voxel data.
              let isDebugSerial = availablePort.manufacturer && availablePort.manufacturer.match(/(PJRC|Teensy)/i);
              let isDataSerial  = availablePort.manufacturer && availablePort.manufacturer.match(/(FTDI)/i);
              let newSerialPort = null;
              //let serialPortIdx = self.connectedSerialPorts.length;
              
              if (isDebugSerial) {
                console.log("Attempting connection with debug/info serial port '" + availablePort.path + "'...");
                newSerialPort = new SerialPort({
                  path: availablePort.path,
                  autoOpen: false,
                  baudRate: DEFAULT_TEENSY_USB_SERIAL_BAUD
                });
                newSerialPort.isVoxelDataConnection = false;
              }
              else if (isDataSerial) {
                // Hardware serial
                console.log("Attempting connection with data streaming serial port '" + availablePort.path + "'...");

                newSerialPort = new SerialPort({
                  path: availablePort.path,
                  autoOpen: false,
                  baudRate: DEFAULT_TEENSY_HW_SERIAL_BAUD,
                  rtscts: true,
                  highWaterMark: (8*VoxelConstants.VOXEL_GRID_SIZE*VoxelConstants.VOXEL_GRID_SIZE*3+4+64), // 8 boards, each board is grid*grid voxels, each colour is 3 bytes, plus extra for headers/protocol
                });
                newSerialPort.isVoxelDataConnection = true;
              }

              if (newSerialPort) {
                newSerialPort.on('error', (spErr) => {
                  console.error("Serial port error: " + spErr);
                  delete self.slaveDataMap[availablePort.path];
                  const spIdx = self.connectedSerialPorts.indexOf(newSerialPort);
                  if (spIdx !== -1) {
                    self.connectedSerialPorts.splice(spIdx, 1);
                    console.log("Removed serial port: " + availablePort.path);
                    setTimeout(serialPoll, SERIAL_POLLING_INTERVAL_MS); // Poll again soon...
                  }
                });

                newSerialPort.on('close', () => {
                  console.log("Serial port closed: " + availablePort.path);
                  delete self.slaveDataMap[availablePort.path];
                  const spIdx = self.connectedSerialPorts.indexOf(newSerialPort);
                  if (spIdx !== -1) { 
                    self.connectedSerialPorts.splice(spIdx, 1);
                    console.log("Removed serial port: " + availablePort.path); 
                    setTimeout(serialPoll, SERIAL_POLLING_INTERVAL_MS); // Poll again soon...
                  }
                });

                newSerialPort.on('open', () => {
                  const parser = new ReadlineParser();
                  newSerialPort.pipe(parser);
                  newSerialPort.lastWriteResult = true;

                  if (isDataSerial) {
                    const welcomePacketBuf = VoxelProtocol.buildWelcomePacketForSlaves(self.voxelModel);
                    welcomePacketBuf[0] = 255;
                    try {
                      newSerialPort.write(cobs.encode(welcomePacketBuf, true));
                      console.log("Sent welcome packet to " + availablePort.path);
                    } catch (err) { console.error("Failed to send welcome packet on open: "); console.error(err); }
                  }
                  
                  parser.on('data', (data) => {
                    if (isDataSerial) {
                      const slaveInfoMatch = data.match(/SLAVE_ID (\d)/);
                      
                      if (slaveInfoMatch) {
                        if (!(availablePort.path in self.slaveDataMap)) {
                          const slaveDataObj = { id: parseInt(slaveInfoMatch[1]) };
                          self.slaveDataMap[availablePort.path] = slaveDataObj;

                          // First time getting information from the current serial port, send a welcome packet
                          console.log("Slave ID at " + availablePort.path + " = " + self.slaveDataMap[availablePort.path].id);
                          console.log("Sending welcome packet to " + availablePort.path + "...");
            
                          const welcomePacketBuf = VoxelProtocol.buildWelcomePacketForSlaves(self.voxelModel);
                          welcomePacketBuf[0] = slaveDataObj.id;
                          try {
                            newSerialPort.write(cobs.encode(welcomePacketBuf, true));
                          } catch (err) { console.error("Failed to send welcome packet on data: "); console.error(err); }
                        }
                        else {
                          const slaveId = parseInt(slaveInfoMatch[1]);
                          self.slaveDataMap[availablePort.path].id = slaveId;
                          
                          /*
                          // TODO: 
                          // Server event: Slave (slaveId) connected
                          if (this.viewerWebSocks.length > 0) {
                            const statePkt = VoxelProtocol.buildServerStateEventPacketStr(
                                VoxelProtocol.SERVER_STATE_EVENT_SLAVE_TYPE,
                                {slaveId, connected: true, message: "Slave added to server."}
                            );
                            for (const viewerWS of this.viewerWebSocks) {
                              viewerWS.send(statePkt);
                            }
                          }
                          */
                        }
                      }
                    }
                    else {
                      console.log(data);
                      console.log("Current Server Frame: #" + (self.voxelModel.frameCounter % 65536));
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

            } // for ports
          } // try
          catch (err) {
            console.error("Serial port try-catch error:");
            console.error(err);
            
            console.log("Resetting and closing all serial ports...");
            try {
              for (const port of self.connectedSerialPorts) { port.close(); }
            } catch (err) {}
            self.connectedSerialPorts = [];
          }

          setTimeout(serialPoll, SERIAL_POLLING_INTERVAL_MS); // Poll again soon...
        },
        err => {
          console.error("SerialPort.list() promise error:");
          console.error(err);
        }
      );
    };

    setImmediate(serialPoll);
  }

  stop() {
    this.connectedSerialPorts.forEach((currSerialPort) => {
      try { currSerialPort.close(); } catch (err) {}
    });
  }

  sendClientSocketVoxelData(voxelData) {
    if (this.connectedSerialPorts.length > 0) {
      //console.log("Number of serial ports connected: " +this.connectedSerialPorts.length);

      try {
        // Send data frames out through all connected serial ports
        for (const currSerialPort of this.connectedSerialPorts) {
          if (!currSerialPort.isOpen) {
            // Try to reconnect...
            console.log("Serial port (" + currSerialPort.port + ") no longer open, attempting to reconnect...");
            currSerialPort.open();
          }
          else if (currSerialPort.isVoxelDataConnection) {
            const slaveData = this.slaveDataMap[currSerialPort.path];
            // Make sure there's a slave to send the data to and that the serial port has been drained after the previous write
            if (slaveData && currSerialPort.lastWriteResult) {
              //console.log("Sending slave data for " + currSerialPort.path + ", id: " + slaveData.id);
              const voxelDataSlavePacketBuf = VoxelProtocol.buildVoxelDataPacketForSlaves(voxelData, slaveData.id);
              const encodedPacketBuf = cobs.encode(voxelDataSlavePacketBuf, true);
              currSerialPort.lastWriteResult = currSerialPort.write(encodedPacketBuf);
              currSerialPort.drain((err) => {
                if (err) {  console.error(err); }
                currSerialPort.lastWriteResult = true;
              });
            }
            else {
              //console.log("Failed to send slave data: " + (slaveData ? "" : "Data empty") + " " + (currSerialPort.lastWriteResult ? "" : "Not finished writing."));
            }
          }
        }
      } catch (err) {}
    }

    // Send voxel data to the viewer websocket client
    if (this.viewerWebSocks.length > 0) {
      const voxelDataPkt = VoxelProtocol.buildVoxelDataPacket(voxelData);
      for (const viewerWS of this.viewerWebSocks) {
        if (viewerWS.bufferedAmount === 0) { viewerWS.send(voxelDataPkt); }
      }
    }
  }

  sendViewerPacketStr(packetStr) {
    for (const viewerWS of this.viewerWebSocks) { viewerWS.send(packetStr); }
  }

  areSlavesConnected() {
    return (Object.keys(this.slaveDataMap).length === 2);
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
