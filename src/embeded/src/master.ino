 
#include "../slave/common/comm.h"
#include "../slave/common/voxel.h"
#include "MasterClient.h"

MasterClient client;

LED3DPacketSerial myPacketSerial;
static uint8_t packetBuffer[PACKET_BUFFER_MAX_SIZE];


static unsigned long TIME_UNTIL_RESEND_INIT_PACKET_MICROSECS = (30*1000000);
static unsigned long resendInitPacketCounterMicroSecs = TIME_UNTIL_RESEND_INIT_PACKET_MICROSECS;

void onSerialPacketReceived(const uint8_t* buffer, size_t size) {
  Serial.println("Packet recieved on master.");
}

void setup() {
  Serial.begin(9600); // USB Serial

  Serial1.begin(PACKET_SERIAL_BAUD);
  myPacketSerial.setStream(&Serial1);
  myPacketSerial.setPacketHandler(&onSerialPacketReceived);

  resendInitPacketCounterMicroSecs = TIME_UNTIL_RESEND_INIT_PACKET_MICROSECS;


  // Setup the Discovery client - whenever it connects to the network it tries to discover the server
  
  client.begin();
  
}


static int startCounter = 0;
static unsigned long updateStartCounterMicroSecs = 0;
void loop() {

  // Keep track of frame time
  static unsigned long lastTimeInMicroSecs = micros();
  unsigned long currTimeMicroSecs = micros();
  unsigned long dtMicroSecs = currTimeMicroSecs - lastTimeInMicroSecs;
  lastTimeInMicroSecs = currTimeMicroSecs;

  client.run(dtMicroSecs);

/*
  // Make sure we've been discovered and that we're communicating with the server
  if (!client.receiveDiscoveryAck()) {
    client.sendDiscoveryPacket();
    delay(2500);
  }
*/

/*
  // Every so often we resend the initialization data to our slaves in order to make sure
  // they know the size of the voxel space
  resendInitPacketCounterMicroSecs += dtMicroSecs;
  if (resendInitPacketCounterMicroSecs >= TIME_UNTIL_RESEND_INIT_PACKET_MICROSECS) {
    resendInitPacketCounterMicroSecs = 0;
    packetBuffer[0] = INIT_DATA;
    packetBuffer[1] = VOXEL_MODULE_X_SIZE;
    packetBuffer[2] = VOXEL_MODULE_Y_SIZE;
    packetBuffer[3] = VOXEL_MODULE_Z_SIZE;
    myPacketSerial.send(packetBuffer, 4);
  }

  static const int NUM_VOXELS = VOXEL_MODULE_Y_SIZE*VOXEL_MODULE_Z_SIZE;
  static const int NUM_VOXEL_COMPONENTS = 3*NUM_VOXELS;
  packetBuffer[0] = FULL_VOXEL_DATA;
  int counter = startCounter;
  for (int i = 1; i <= NUM_VOXEL_COMPONENTS; i += 3) {
    switch (counter % 3) {
      case 0:
        packetBuffer[i]   = 255;
        packetBuffer[i+1] = 0;
        packetBuffer[i+2] = 0;
        break;
      case 1:
        packetBuffer[i]   = 0;
        packetBuffer[i+1] = 255;
        packetBuffer[i+2] = 0;
        break;
      case 2:
      default:
        packetBuffer[i]   = 0;
        packetBuffer[i+1] = 0;
        packetBuffer[i+2] = 255;
        break;
    }
    counter++;
  }

  updateStartCounterMicroSecs += dtMicroSecs;
  if (updateStartCounterMicroSecs >= 100000) {
    startCounter++;
    updateStartCounterMicroSecs = 0;
  }

  Serial.println("Sending voxel data.");
  myPacketSerial.send(packetBuffer, NUM_VOXEL_COMPONENTS+1);

  myPacketSerial.update();
  if (myPacketSerial.overflow()) {
    Serial.println("Packet serial overflow...");
  }
  */
}