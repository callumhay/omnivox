#pragma once

#include "../lib/led3d/comm.h"
class VoxelModel;

class SlavePacketWriter {
  public:
    SlavePacketWriter(led3d::LED3DPacketSerial& slaveSerial): slaveSerial(slaveSerial) {};

    bool writeClearVoxels(const VoxelModel& voxelModel, const uint8_t& r, const uint8_t& g, const uint8_t& b);
    bool writeAllVoxels(const VoxelModel& voxelModel);
    
  private:
    led3d::LED3DPacketSerial& slaveSerial;
};