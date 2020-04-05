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
  PacketReader packetReader;
  SlavePacketWriter slavePacketWriter;

  VoxelModel& voxelModel;
  StateType state;
  
  UDP udp;
  TCPClient tcp;

  IPAddress discoveryIP;
  uint16_t udpPort;

  IPAddress serverAddr;
  uint16_t serverPort;

  unsigned long discoveryPacketTimerMicroSecs;

  void setState(const StateType& nextState);

  void sendDiscoveryPacket(unsigned long dtMicroSecs);
  void receiveDiscoveryAck();
  void initiateConnectionWithServer();
  void receiveServerPacket();
};