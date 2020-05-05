#pragma once

#include "../lib/led3d/comm.h"
#include "VoxelModel.h"

#define INIT_PACKET_BUFFER_SIZE 4
#define CLEAR_PACKET_BUFFER_SIZE 6
#define ALL_VOXELS_BUFFER_SIZE (3 + VOXEL_MODULE_X_SIZE * VOXEL_MODULE_Z_SIZE * MAX_VOXEL_Y_SIZE * 3)

class SlavePacketWriter {
  public:
    SlavePacketWriter(led3d::LED3DPacketSerial& slaveSerial): slaveSerial(slaveSerial), 
    hasInitReady(false), hasClearReady(false), hasAllVoxelsReady(false) {};

    void setInit(const VoxelModel& voxelModel);
    void setVoxelsClear(const VoxelModel& voxelModel, const uint8_t& r, const uint8_t& g, const uint8_t& b);
    void setVoxelsAll(const VoxelModel& voxelModel);

    void write(const VoxelModel& voxelModel);

    bool isReady() const { return this->hasInitReady || this->hasClearReady || this->hasAllVoxelsReady; }

  private:
    led3d::LED3DPacketSerial& slaveSerial;
    
    bool hasInitReady;
    bool hasClearReady;
    bool hasAllVoxelsReady;
    
    uint8_t initPacketBuffer[INIT_PACKET_BUFFER_SIZE];
    uint8_t clearPacketBuffer[CLEAR_PACKET_BUFFER_SIZE];
    uint8_t allVoxelsPacketBuffer[ALL_VOXELS_BUFFER_SIZE];
};

inline void SlavePacketWriter::setInit(const VoxelModel& voxelModel) {
  this->initPacketBuffer[1] = static_cast<uint8_t>(WELCOME_HEADER);
  this->initPacketBuffer[2] = voxelModel.getGridSizeY();
  this->initPacketBuffer[3] = static_cast<uint8_t>(PACKET_END_CHAR);

  this->hasInitReady = true;
}

inline void SlavePacketWriter::setVoxelsClear(const VoxelModel& voxelModel, const uint8_t& r, const uint8_t& g, const uint8_t& b) {
  this->clearPacketBuffer[1] = static_cast<uint8_t>(VOXEL_DATA_CLEAR_TYPE);
  this->clearPacketBuffer[2] = r;
  this->clearPacketBuffer[3] = g;
  this->clearPacketBuffer[4] = b;
  this->clearPacketBuffer[5] = static_cast<uint8_t>(PACKET_END_CHAR);

  this->hasClearReady = true;
}

inline void SlavePacketWriter::setVoxelsAll(const VoxelModel& voxelModel) {
  this->allVoxelsPacketBuffer[1] = static_cast<uint8_t>(VOXEL_DATA_ALL_TYPE);
  this->hasAllVoxelsReady = true;
}

inline void SlavePacketWriter::write(const VoxelModel& voxelModel) {
  const int numSlaves = voxelModel.getNumSlaves();

  if (this->hasInitReady) {
    for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
      this->initPacketBuffer[0] = static_cast<uint8_t>(slaveId);
      this->slaveSerial.send(this->initPacketBuffer, INIT_PACKET_BUFFER_SIZE);
    }
    this->hasInitReady = false;
  }

  if (this->hasAllVoxelsReady) {
    size_t allVoxelsPacketBufferSize;
    for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
      this->allVoxelsPacketBuffer[0] = static_cast<uint8_t>(slaveId);
      
      const FlatVoxelVec& slaveVoxels = voxelModel.getSlaveVoxels(slaveId);
      std::copy(slaveVoxels.begin(), slaveVoxels.end(), &this->allVoxelsPacketBuffer[2]);

      allVoxelsPacketBufferSize = 3 + slaveVoxels.size();
      this->allVoxelsPacketBuffer[allVoxelsPacketBufferSize-1] = static_cast<uint8_t>(PACKET_END_CHAR);

      this->slaveSerial.send(this->allVoxelsPacketBuffer, allVoxelsPacketBufferSize);
    }
    this->hasAllVoxelsReady = false;
    this->hasClearReady = false;
  }
  else if (this->hasClearReady) {
    for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
      this->clearPacketBuffer[0] = static_cast<uint8_t>(slaveId);
      this->slaveSerial.send(this->clearPacketBuffer, CLEAR_PACKET_BUFFER_SIZE);
    }
    this->hasClearReady = false;
  }

}