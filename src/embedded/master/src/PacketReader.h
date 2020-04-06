#pragma once

#include "../lib/led3d/comm.h"
#include "VoxelModel.h"
#include "SlavePacketWriter.h"

class PacketReader {
private:
  enum ReaderState {
    READING_HEADER,
    READING_SUB_HEADER,
    READING_BODY,
    READING_END
  };

public:
  PacketReader(const VoxelModel& voxelModel) { this->reset(voxelModel); };
  ~PacketReader() {};

  bool read(TCPClient& tcp, VoxelModel& voxelModel);

private:
  ReaderState state;
  char currPacketTypeByte;
  char currSubPacketTypeByte;
  uint32_t currExpectedBytes;

  SlavePacketWriter slavePacketWriter;

  void setState(ReaderState nextState, const VoxelModel& voxelModel);

  void reset(const VoxelModel& voxelModel) { this->setState(PacketReader::READING_HEADER, voxelModel); };
  bool readBody(TCPClient& tcp, VoxelModel& voxelModel);
  
};

inline bool PacketReader::read(TCPClient& tcp, VoxelModel& voxelModel) {
  switch (this->state) {

    case PacketReader::READING_HEADER:
      if (tcp.available() >= 1) {
        this->currPacketTypeByte = static_cast<char>(tcp.read());
        if (this->currPacketTypeByte == VOXEL_DATA_HEADER) {
          this->setState(PacketReader::READING_SUB_HEADER, voxelModel);
        }
        else {
          this->setState(PacketReader::READING_BODY, voxelModel);
        }
      }
      break;

    case PacketReader::READING_SUB_HEADER:
      if (tcp.available() >= 1) {
        this->currSubPacketTypeByte = static_cast<char>(tcp.read());
        this->setState(PacketReader::READING_BODY, voxelModel);
      }
      break;

    case PacketReader::READING_BODY:
      return this->readBody(tcp, voxelModel);

    case PacketReader::READING_END:
      // TODO: Count the number of times we loop here and have a stop on it, just in case
      while (tcp.available() > 0) {
        if (static_cast<char>(tcp.read()) == PACKET_END_CHAR) {
          this->reset(voxelModel);
          break;
        }
      }
      break;

    default:
      Serial.println("Invalid PacketReader state.");
      this->setState(PacketReader::READING_HEADER, voxelModel);
      return false;
  }

  return true;
};

inline void PacketReader::setState(PacketReader::ReaderState nextState, const VoxelModel& voxelModel) {
  switch (nextState) {

    case PacketReader::READING_HEADER:
      this->currPacketTypeByte    = '0';
      this->currSubPacketTypeByte = '0';
      this->currExpectedBytes     = 0;
      break;

    case PacketReader::READING_SUB_HEADER:
      this->currSubPacketTypeByte = '0';
      this->currExpectedBytes     = 0;
      break;

    case PacketReader::READING_BODY:
      switch (this->currPacketTypeByte) {
        
        case WELCOME_HEADER:
          this->currExpectedBytes = 1;
          break;

        case VOXEL_DATA_HEADER:
          switch (this->currSubPacketTypeByte) {
            case VOXEL_DATA_ALL_TYPE:
              this->currExpectedBytes = voxelModel.getGridSizeX() * voxelModel.getGridSizeY() * voxelModel.getGridSizeZ() * 6; // RGB hex for every voxel in the grid
              break;
            case VOXEL_DATA_CLEAR_TYPE:
              this->currExpectedBytes = 3; // Just the clear colour RGB
              break;
            default:
              Serial.println("Voxel data header type not found!");
              this->reset(voxelModel);
              break;
          }
          break;

        default:
          Serial.println("Packet type not found!");
          this->reset(voxelModel);
          break;
      }
      break;

    case PacketReader::READING_END:
      this->currExpectedBytes = 1;
      break;

    default:
      Serial.println("Attempting to set an invalid PacketReader state.");
      this->reset(voxelModel);
      break;
  }
  this->state = nextState;
}

inline bool PacketReader::readBody(TCPClient& tcp, VoxelModel& voxelModel) {
  // No point branching or reading anything until we know we have the appropriate number of bytes available 
  if (tcp.available() < this->currExpectedBytes) {
    return true;
  }

  bool noError = true;
  switch (this->currPacketTypeByte) {
    
    case WELCOME_HEADER: {
      // The welcome header contains data about the size of the voxel grid
      Serial.println("Welcome packet found with grid size info.");
      const uint8_t gridSize = tcp.read();
      if (gridSize > 0) {
        voxelModel.init(gridSize, gridSize, gridSize);
        Serial.printlnf("Voxel model grid size set to %i x %i x %i", gridSize, gridSize, gridSize);

        noError = this->slavePacketWriter.writeInit(voxelModel);
        this->setState(PacketReader::READING_END, voxelModel);
      }
      else {
        Serial.println("Invalid grid size of zero was found.");
        noError = false;
      }

      break;
    }

    case VOXEL_DATA_HEADER:
      Serial.println("Voxel data packet found."); // TODO: REMOVE ME

      switch (this->currSubPacketTypeByte) {
        case VOXEL_DATA_ALL_TYPE: {
          // We need to read the data and parse it up into proper modules (and the proper ordering within those modules) for sending out to slaves
          int xSize = voxelModel.getGridSizeX();
          int ySize = voxelModel.getGridSizeY();
          int zSize = voxelModel.getGridSizeZ();

          const int numSlaves = voxelModel.getNumSlaves();
          for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
            FlatVoxelVec& slaveVoxels = voxelModel.getSlaveVoxels(slaveId);
            slaveVoxels.clear();
          }

          int currSlaveId, startIdx;
          static const int TEMP_BUFFER_SIZE = VOXEL_MODULE_Z_SIZE*3;
          static uint8_t tempBuffer[TEMP_BUFFER_SIZE];

          for (int x = 0; x < xSize; x++) {
            for (int y = 0; y < ySize; y++) {
              startIdx = (x*xSize + y*ySize)*3;

              for (int z = 0; z < zSize; z += VOXEL_MODULE_Z_SIZE) {
                currSlaveId = static_cast<int>(x / VOXEL_MODULE_X_SIZE) * zSize + static_cast<int>(z / VOXEL_MODULE_Z_SIZE);
                FlatVoxelVec& slaveVoxels = voxelModel.getSlaveVoxels(currSlaveId);
                tcp.readBytes((char*)tempBuffer, TEMP_BUFFER_SIZE);
                slaveVoxels.insert(slaveVoxels.end(), tempBuffer, tempBuffer+TEMP_BUFFER_SIZE);
              }
            }
          }

          // Send the parsed voxel data out to the slaves
          noError = this->slavePacketWriter.writeVoxelsAll(voxelModel);
          this->setState(PacketReader::READING_END, voxelModel);
          break;
        }

        case VOXEL_DATA_CLEAR_TYPE:
          // Just reading 3 bytes (3x8-bit values) for the clear colour RGB
          noError = this->slavePacketWriter.writeVoxelsClear(voxelModel, static_cast<uint8_t>(tcp.read()), static_cast<uint8_t>(tcp.read()), static_cast<uint8_t>(tcp.read()));
          this->setState(PacketReader::READING_END, voxelModel);
          break;

        default:
          break;
      }
      break;

    default:
      Serial.println("Packet type not found!");
      this->reset(voxelModel);
      break;
  }

  return noError;
}