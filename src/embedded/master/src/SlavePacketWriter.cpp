#include "SlavePacketWriter.h"
#include "VoxelModel.h"

bool SlavePacketWriter::writeClearVoxels(const VoxelModel& voxelModel, const uint8_t& r, const uint8_t& g, const uint8_t& b) {
  static const int CLEAR_PACKET_BUFFER_SIZE = 6;
  static uint8_t clearPacketBuffer[CLEAR_PACKET_BUFFER_SIZE] = {0, static_cast<uint8_t>(VOXEL_DATA_CLEAR_TYPE), 0, 0, 0, static_cast<uint8_t>(PACKET_END_CHAR)};

  const int numSlaves = voxelModel.getNumSlaves();
  for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
    clearPacketBuffer[0] = slaveId;
    clearPacketBuffer[2] = r;
    clearPacketBuffer[3] = g;
    clearPacketBuffer[4] = b;
    this->slaveSerial.send(clearPacketBuffer, CLEAR_PACKET_BUFFER_SIZE);
  }

  return true;
}

bool SlavePacketWriter::writeAllVoxels(const VoxelModel& voxelModel) {
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