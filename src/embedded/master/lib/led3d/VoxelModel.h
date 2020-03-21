#pragma once

#include <Arduino.h>

class VoxelModel {
  public:
    VoxelModel(): gridSizeX(0), gridSizeY(0), gridSizeZ(0) {}
    void init(uint8_t xSize, uint8_t ySize, uint8_t zSize) {
      this->gridSizeX = xSize;
      this->gridSizeY = ySize;
      this->gridSizeZ = zSize;
    }

    uint8_t getGridSizeX() const { return this->gridSizeX; }
    uint8_t getGridSizeY() const { return this->gridSizeY; }
    uint8_t getGridSizeZ() const { return this->gridSizeZ; }

  private:
    uint8_t gridSizeX, gridSizeY, gridSizeZ;
};
