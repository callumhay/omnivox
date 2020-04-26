#pragma once

#include "../lib/led3d/comm.h"
#include "PacketReader.h"

class MasterClient {
private:
  enum StateType { 
    DISCOVERING = 0, 
    CONNECTING, 
    CONNECTED 
  };

public:
  MasterClient(VoxelModel& voxelModel, led3d::LED3DPacketSerial& slaveSerial);
  ~MasterClient();

  // This must be called at startup
  void begin() {
    this->state = DISCOVERING;
    this->udp.begin(this->udpPort);
    this->udp.joinMulticast(this->discoveryIP);
  }

  void run(unsigned long dtMicroSecs);

private:
  VoxelModel& voxelModel;
  
  PacketReader packetReader;
  StateType state;
  
  UDP udp;
  TCPClient tcp;

  uint16_t udpPort;
  IPAddress discoveryIP;
  IPAddress serverAddr;
  uint16_t serverPort;

  unsigned long discoveryPacketTimerMicroSecs;

  void setState(const StateType& nextState);

  void sendDiscoveryPacket(unsigned long dtMicroSecs);
  void receiveDiscoveryAck();
  void initiateConnectionWithServer();
  void receiveServerPacket(unsigned long dtMicroSecs);

  static void readUntil(UDP& udp, std::vector<char>& buffer, char untilChar) {
    buffer.clear();
    while (udp.available()) {
      buffer.push_back(udp.read());
      if (buffer.back() == untilChar) {
        buffer.pop_back();
        break;
      }
    }
  }
};