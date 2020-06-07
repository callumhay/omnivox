 
#include "../lib/led3d/comm.h"
#include "../lib/led3d/voxel.h"

#include "VoxelModel.h"
#include "MasterClient.h"

led3d::LED3DPacketSerial slaveSerial;
VoxelModel voxelModel;
MasterClient client(voxelModel, slaveSerial);

// Recieve incoming serial packets from slave(s)
void onSerialPacketReceived(const uint8_t* buffer, size_t size) {
  Serial.println("Packet recieved on master.");
}

void setup() {
  #if defined(DEBUG_BUILD)
  Mesh.off();
  BLE.off();
  #endif

  //Particle.disconnect();
  Particle.connect();

  Serial.begin(9600); // USB Serial

  Serial1.begin(PACKET_SERIAL_BAUD);
  slaveSerial.setStream(&Serial1);
  slaveSerial.setPacketHandler(&onSerialPacketReceived);

  // Setup the client - whenever it connects to the network it tries to discover the server, it has a state
  // machine that will listen for the appropriate data and take actions based on that
  client.begin();
}

void loop() {
  /*
  if (!Particle.disconnected()) {
    Particle.disconnect();
  }
  */

  // Keep track of frame time
  static unsigned long lastTimeInMicroSecs = micros();
  unsigned long currTimeMicroSecs = micros();
  unsigned long dtMicroSecs = currTimeMicroSecs - lastTimeInMicroSecs;
  lastTimeInMicroSecs = currTimeMicroSecs;

  // Listen for incoming data, parse it, do the heavy lifting
  client.run(dtMicroSecs);

  // For recieving / decoding incoming packets from the slave (if any)
  slaveSerial.update();
}