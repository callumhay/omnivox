#pragma once

#include "../lib/led3d/comm.h"
#include "../lib/led3d/VoxelModel.h"

class PacketReader {
private:
  enum ReaderState {
    READING_HEADER,
    READING_SUB_HEADER,
    READING_BODY,
    READING_END
  };

public:
  PacketReader() { this->reset(); };
  ~PacketReader() {};

  bool read(TCPClient& tcp, VoxelModel& voxelModel);

private:
  ReaderState state;
  char currPacketTypeByte;
  char currSubPacketTypeByte;
  uint32_t currExpectedBytes;

  void setState(ReaderState nextState, const VoxelModel& voxelModel);

  void reset() {this->setState(PacketReader::READING_HEADER);};
  bool readBody(TCPClient& tcp, VoxelModel& voxelModel);
  
};

inline void PacketReader::read(TCPClient& tcp, VoxelModel& voxelModel) {
  switch (this->state) {

    case PacketReader::READING_HEADER:
      if (tcp.available() >= 1) {
        this->currPacketTypeByte = static_cast<char>(tcp.read());
        if (this->currPacketTypeByte == VOXEL_DATA_HEADER) {
          this->setState(PacketReader::READING_SUB_HEADER);
        }
        else {
          this->setState(PacketReader::READING_BODY);
        }
      }
      break;

    case PacketReader::READING_SUB_HEADER:
      if (tcp.available() >= 1) {
        this->currSubPacketTypeByte = static_cast<char>(tcp.read());
        this->setState(PacketReader::READING_BODY);
      }
      break;

    case PacketReader::READING_BODY:
      return this->readBody(tcp, voxelModel);

    case PacketReader::READING_END:
      // TODO: Count the number of times we loop here and have a stop on it, just in case
      while (tcp.available() > 0) {
        if (static_cast<char>(tcp.read()) == PACKET_END_CHAR) {
          this->reset();
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
              this->currExpectedBytes = 6; // Just the clear colour RGB hex
              break;
            default:
              Serial.println("Voxel data header type not found!");
              this->reset();
              break;
          }
          break;

        default:
          Serial.println("Packet type not found!");
          this->reset();
          break;
      }
      break;

    case PacketReader::READING_END:
      break;

    default:
      Serial.println("Attempting to set an invalid PacketReader state.");
      this->reset();
      break;
  }
  this->state = nextState;
}

inline void PacketReader::readBody(TCPClient& tcp, VoxelModel& voxelModel) {
 switch (this->currPacketTypeByte) {
    
    case WELCOME_HEADER: {
      if (tcp.available() >= this->currExpectedBytes) {
        Serial.println("Welcome packet found with grid size info.");
        const uint8_t gridSize = this->tcp.read();
        if (gridSize > 0) {
          this->voxelModel.init(gridSize, gridSize, gridSize);
          Serial.printlnf("Voxel model grid size set to %i x %i x %i", gridSize, gridSize, gridSize);
          this->setState(PacketReader::READING_END)
        }
        else {
          Serial.println("Invalid grid size of zero was found.");
          return false;
        }
      }
      break;
    }

    case VOXEL_DATA_HEADER:
      Serial.println("Voxel data packet found.");
      // TODO
      break;

    default:
      Serial.println("Packet type not found!");
      this->reset();
      break;
  }

  return true;
}