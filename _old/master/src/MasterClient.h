#pragma once

#include "../lib/led3d/comm.h"
#include "PacketReader.h"
#include "SlavePacketWriter.h"

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

  void begin();  // This must be called at startup
  void run(unsigned long dtMicroSecs);

private:
  VoxelModel& voxelModel;
  
  SlavePacketWriter slavePacketWriter;
  PacketReader packetReader;
  
  StateType state;
  
  UDP udp;
  TCPClient tcp;

  IPAddress discoveryIP;
  IPAddress dataIP;

  IPAddress serverAddr;
  uint16_t serverPort;

  unsigned long discoveryPacketTimerMicroSecs;

  void setState(const StateType& nextState);

  void sendDiscoveryPacket(unsigned long dtMicroSecs);
  void receiveDiscoveryAck();
  void initiateConnectionWithServer();
  void receiveServerPacket(unsigned long dtMicroSecs);
  void sendSlavePackets(unsigned long dtMicroSecs);

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