/******************************************************/
//       THIS IS A GENERATED FILE - DO NOT EDIT       //
/******************************************************/

#include "application.h"
#line 1 "g:/projects/led3d/master/src/master.ino"
 
#include "../slave/common/comm.h"

void onSerialPacketReceived(const uint8_t* buffer, size_t size);
void setup();
void loop();
#line 4 "g:/projects/led3d/master/src/master.ino"
LED3DPacketSerial myPacketSerial;
static uint8_t packetBuffer[PACKET_BUFFER_MAX_SIZE];

void onSerialPacketReceived(const uint8_t* buffer, size_t size) {
  Serial.println("Packet recieved on master.");
}

void setup() {
  Serial.begin(9600); // USB Serial

  Serial1.begin(PACKET_SERIAL_BAUD);
  myPacketSerial.setStream(&Serial1);
  myPacketSerial.setPacketHandler(&onSerialPacketReceived);

  Serial.println("Starting up...");
}

void loop() {
  Serial.println("Sending data...");

  packetBuffer[0] = FULL_TEXEL_DATA;
  myPacketSerial.send(packetBuffer, PACKET_BUFFER_MAX_SIZE);

  myPacketSerial.update();
  if (myPacketSerial.overflow()) {
    Serial.println("Packet serial overflow...");
  }
}