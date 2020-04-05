#pragma once

#include <Arduino.h>
#include "../lib/led3d/voxel.h"

#undef max
#undef min
#include <vector>

typedef std::vector<uint8_t> FlatVoxelVec;
typedef std::vector<FlatVoxelVec> VoxelModuleVec;

class VoxelModel {
  public:
    VoxelModel(): gridSizeX(0), gridSizeY(0), gridSizeZ(0) {}
    
    void init(uint8_t xSize, uint8_t ySize, uint8_t zSize) {
      this->gridSizeX = xSize;
      this->gridSizeY = ySize;
      this->gridSizeZ = zSize;

      // Build all the required voxel module arrays
      const int numSlaves = this->getNumSlaves();
      this->voxelModules.resize(numSlaves);
      for (int i = 0; i < numSlaves; i++) {
        this->voxelModules[i].resize(VOXEL_MODULE_X_SIZE * VOXEL_MODULE_Y_SIZE * this->gridSizeZ * 3); // RGB values for all voxels in each slave module
      }
    }

    uint8_t getGridSizeX() const { return this->gridSizeX; }
    uint8_t getGridSizeY() const { return this->gridSizeY; }
    uint8_t getGridSizeZ() const { return this->gridSizeZ; }

    int getNumSlaves() const { return (this->gridSizeX / VOXEL_MODULE_X_SIZE) * (this->gridSizeY / VOXEL_MODULE_Y_SIZE);}

    const FlatVoxelVec& getSlaveVoxels(int slaveId) const { return this->voxelModules[slaveId]; }

  private:
    uint8_t gridSizeX, gridSizeY, gridSizeZ;
    VoxelModuleVec voxelModules;

};
