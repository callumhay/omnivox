#pragma once

#include "../lib/led3d/comm.h"
#include "VoxelModel.h"

class SlavePacketWriter {
  public:
    SlavePacketWriter(led3d::LED3DPacketSerial& slaveSerial): slaveSerial(slaveSerial) {};

    bool writeInit(const VoxelModel& voxelModel) const;
    bool writeVoxelsClear(const VoxelModel& voxelModel, const uint8_t& r, const uint8_t& g, const uint8_t& b) const;
    bool writeVoxelsAll(const VoxelModel& voxelModel) const;

  private:
    led3d::LED3DPacketSerial& slaveSerial;
};

inline bool SlavePacketWriter::writeInit(const VoxelModel& voxelModel) const {
  static const int INIT_PACKET_BUFFER_SIZE = 4;
  static uint8_t packetBuffer[INIT_PACKET_BUFFER_SIZE] = {0, static_cast<uint8_t>(WELCOME_HEADER), 0, static_cast<uint8_t>(PACKET_END_CHAR)};

  const int numSlaves = voxelModel.getNumSlaves();
  for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
    packetBuffer[0] = slaveId;
    packetBuffer[2] = voxelModel.getGridSizeY();
    this->slaveSerial.send(packetBuffer, INIT_PACKET_BUFFER_SIZE);
  }

  return true;
}

inline bool SlavePacketWriter::writeVoxelsClear(const VoxelModel& voxelModel, const uint8_t& r, const uint8_t& g, const uint8_t& b) const {
  static const int CLEAR_PACKET_BUFFER_SIZE = 6;
  static uint8_t packetBuffer[CLEAR_PACKET_BUFFER_SIZE] = {0, static_cast<uint8_t>(VOXEL_DATA_CLEAR_TYPE), 0, 0, 0, static_cast<uint8_t>(PACKET_END_CHAR)};

  const int numSlaves = voxelModel.getNumSlaves();
  for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
    packetBuffer[0] = slaveId;
    packetBuffer[2] = r;
    packetBuffer[3] = g;
    packetBuffer[4] = b;
    this->slaveSerial.send(packetBuffer, CLEAR_PACKET_BUFFER_SIZE);
  }

  return true;
}

inline bool SlavePacketWriter::writeVoxelsAll(const VoxelModel& voxelModel) const {
  int minX, minY, maxX, maxY;
  uint8_t tempByte;

  const int numSlaves = voxelModel.getNumSlaves();
  for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
    tempByte = static_cast<uint8_t>(slaveId);
    this->slaveSerial.send(&tempByte, 1);

    const FlatVoxelVec& slaveVoxels = voxelModel.getSlaveVoxels(slaveId);
    this->slaveSerial.send(&slaveVoxels[0], slaveVoxels.size());

    tempByte = static_cast<uint8_t>(PACKET_END_CHAR);
    this->slaveSerial.send(&tempByte, 1);
  }

  return true;
}