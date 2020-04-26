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

  Serial.println("Sending init/welcome data to slaves...");
  const int numSlaves = voxelModel.getNumSlaves();
  for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
    packetBuffer[0] = static_cast<uint8_t>(slaveId);
    packetBuffer[2] = voxelModel.getGridSizeY();
    this->slaveSerial.send(packetBuffer, INIT_PACKET_BUFFER_SIZE);
  }

  return true;
}

inline bool SlavePacketWriter::writeVoxelsClear(const VoxelModel& voxelModel, const uint8_t& r, const uint8_t& g, const uint8_t& b) const {
  static const int CLEAR_PACKET_BUFFER_SIZE = 6;
  static uint8_t packetBuffer[CLEAR_PACKET_BUFFER_SIZE] = {0, static_cast<uint8_t>(VOXEL_DATA_CLEAR_TYPE), 0, 0, 0, static_cast<uint8_t>(PACKET_END_CHAR)};

  Serial.println("Sending voxel clear data to slaves...");
  const int numSlaves = voxelModel.getNumSlaves();
  for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
    packetBuffer[0] = static_cast<uint8_t>(slaveId);
    packetBuffer[2] = r;
    packetBuffer[3] = g;
    packetBuffer[4] = b;
    this->slaveSerial.send(packetBuffer, CLEAR_PACKET_BUFFER_SIZE);
  }

  return true;
}

inline bool SlavePacketWriter::writeVoxelsAll(const VoxelModel& voxelModel) const {
  static const int ALL_VOXELS_BUFFER_SIZE = 3 + VOXEL_MODULE_X_SIZE * VOXEL_MODULE_Z_SIZE * MAX_VOXEL_Y_SIZE * 3;
  static uint8_t packetBuffer[ALL_VOXELS_BUFFER_SIZE];
  size_t packetSize;

  const int numSlaves = voxelModel.getNumSlaves();
  for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
    packetBuffer[0] = static_cast<uint8_t>(slaveId);
    packetBuffer[1] = static_cast<uint8_t>(VOXEL_DATA_ALL_TYPE);

    const FlatVoxelVec& slaveVoxels = voxelModel.getSlaveVoxels(slaveId);
    std::copy(slaveVoxels.begin(), slaveVoxels.end(), &packetBuffer[2]);

    packetSize = 3 + slaveVoxels.size();
    packetBuffer[packetSize-1] = static_cast<uint8_t>(PACKET_END_CHAR);

    this->slaveSerial.send(&packetBuffer[0], packetSize);
  }

  return true;
}