#pragma once

#include "../lib/led3d/comm.h"
#include "VoxelModel.h"
#include "SlavePacketWriter.h"

#define TIMEOUT_READ_TIME_MICROSECS 1e6

class PacketReader {
private:
  enum ReaderState {
    READING_HEADER,
    READING_SUB_HEADER,
    READING_BODY,
    READING_END
  };

public:
  PacketReader(const VoxelModel& voxelModel, led3d::LED3DPacketSerial& slaveSerial) : 
    slavePacketWriter(slaveSerial) { this->reset(voxelModel); };

  ~PacketReader() {};

  bool read(TCPClient& tcp, VoxelModel& voxelModel, unsigned long dtMicroSecs);

private:
  ReaderState state;
  char currPacketTypeByte;
  char currSubPacketTypeByte;

  int currExpectedBytes;
  int currByteCount;

  unsigned long readTimeMs;

  uint8_t buffer[12288];

  SlavePacketWriter slavePacketWriter;

  void setState(ReaderState nextState, const VoxelModel& voxelModel);

  void reset(const VoxelModel& voxelModel) { this->setState(PacketReader::READING_HEADER, voxelModel); };
  bool readBody(TCPClient& tcp, VoxelModel& voxelModel, unsigned long dtMicroSecs);
  
};

inline bool PacketReader::read(TCPClient& tcp, VoxelModel& voxelModel, unsigned long dtMicroSecs) {
  switch (this->state) {

    case PacketReader::READING_HEADER: {
      
      if (tcp.available() > 0) {
        this->currPacketTypeByte = static_cast<char>(tcp.read());

        //Serial.print("Reading Header: ");
        //Serial.println(this->currPacketTypeByte);

        if (this->currPacketTypeByte == VOXEL_DATA_HEADER) {
          this->setState(PacketReader::READING_SUB_HEADER, voxelModel);
        }
        else {
          this->setState(PacketReader::READING_BODY, voxelModel);
        }
      }
      break;
    }

    case PacketReader::READING_SUB_HEADER: {
      if (tcp.available() > 0) {
        this->currSubPacketTypeByte = static_cast<char>(tcp.read());

        //Serial.print("Reading Subheader: ");
        //Serial.println(this->currSubPacketTypeByte);

        this->setState(PacketReader::READING_BODY, voxelModel);
      }
      break;
    }

    case PacketReader::READING_BODY: {
      //Serial.println("Reading body...");
      if (!this->readBody(tcp, voxelModel, dtMicroSecs)) {
        Serial.println("Error or timeout while reading body, resetting reader.");
        this->reset(voxelModel);
      }
      break;
    }

    case PacketReader::READING_END: {
      bool endFound = false;
      while (!endFound && tcp.available() > 0) {
        char currChar = static_cast<char>(tcp.read());
        if (currChar == PACKET_END_CHAR) {
          //Serial.println("Packet end found, resetting reader.");
          this->reset(voxelModel); // Resetting will put us back into an "idle" state (i.e., wait to read the next packet header)
          endFound = true;
        }
      }
      break;
    }

    default:
      Serial.println("Invalid PacketReader state.");
      this->reset(voxelModel);
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
      this->currByteCount         = 0;
      this->readTimeMs            = 0;
      break;

    case PacketReader::READING_SUB_HEADER:
      this->currSubPacketTypeByte = '0';
      this->currExpectedBytes     = 0;
      this->currByteCount         = 0;
      this->readTimeMs            = 0;
      break;

    case PacketReader::READING_BODY: {
      this->currByteCount = 0;
      this->readTimeMs = 0;
      switch (this->currPacketTypeByte) {
        
        case WELCOME_HEADER:
          this->currExpectedBytes = 1;
          break;

        case VOXEL_DATA_HEADER: {
          switch (this->currSubPacketTypeByte) {

            case VOXEL_DATA_ALL_TYPE:
              this->currExpectedBytes = (voxelModel.getGridSizeX() * voxelModel.getGridSizeY() * voxelModel.getGridSizeZ() * 3); // RGB bytes for every voxel in the grid
              break;

            case VOXEL_DATA_CLEAR_TYPE:
              this->currExpectedBytes = 3; // Just the clear colour RGB
              break;

            default:
              Serial.println("Voxel data header type not found!");
              this->reset(voxelModel);
              return;
          }
          break;
        }

        default:
          Serial.print("Packet type not found: "); Serial.println(this->currPacketTypeByte);
          this->reset(voxelModel);
          return;
      }
      break;
    }

    case PacketReader::READING_END:
      this->currByteCount     = 0;
      this->currExpectedBytes = 1;
      this->readTimeMs        = 0;
      break;

    default:
      Serial.println("Attempting to set an invalid PacketReader state.");
      this->reset(voxelModel);
      return;
  }

  this->state = nextState;
}

inline bool PacketReader::readBody(TCPClient& tcp, VoxelModel& voxelModel, unsigned long dtMicroSecs) {

  // Piece together the body of the package (we need to do this because the particle library for TCP has a tiny buffer)
  if (this->currByteCount < this->currExpectedBytes) {
    this->currByteCount += std::max<int>(0, tcp.read(&(this->buffer[this->currByteCount]), this->currExpectedBytes - this->currByteCount));
    //Serial.printlnf("Reading body (%d / %d)", this->currByteCount, this->currExpectedBytes);
    if (this->currByteCount < this->currExpectedBytes) {

      // If we've been waiting too long then we need to return false and get out of this state
      this->readTimeMs += dtMicroSecs;
      return this->readTimeMs <= TIMEOUT_READ_TIME_MICROSECS;
    }
  }

  /*
  for (int i = 0; i < this->currByteCount; i++) {
    Serial.print(static_cast<char>(this->buffer[i]));
  }
  Serial.println();
  */

  bool noError = true;
  switch (this->currPacketTypeByte) {
    
    case WELCOME_HEADER: {
      // The welcome header contains data about the size of the voxel grid
      Serial.println("Welcome packet found with grid size info.");
      const uint8_t& gridSize = this->buffer[0];
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

    case VOXEL_DATA_HEADER: {
      switch (this->currSubPacketTypeByte) {
        case VOXEL_DATA_ALL_TYPE: {
          //Serial.println("Reading full voxel data packet body.");

          // We need to read the data and parse it up into proper modules (and the proper ordering within those modules) for sending out to slaves
          int xSize = voxelModel.getGridSizeX();
          int ySize = voxelModel.getGridSizeY();
          int zSize = voxelModel.getGridSizeZ();

          const int numSlaves = voxelModel.getNumSlaves();
          for (int slaveId = 0; slaveId < numSlaves; slaveId++) {
            FlatVoxelVec& slaveVoxels = voxelModel.getSlaveVoxels(slaveId);
            slaveVoxels.clear();
          }

          int currSlaveId;
          int bufferIdxCount = 0;
          static const int READ_BUFFER_SIZE = VOXEL_MODULE_Z_SIZE*3;

          for (int x = 0; x < xSize; x++) {
            for (int y = 0; y < ySize; y++) {
              for (int z = 0; z < zSize; z += VOXEL_MODULE_Z_SIZE) {
                
                /*
                if (x == 0 && y == 0 && z == 0) {
                  int temp = bufferIdxCount;
                  Serial.print(buffer[temp]); Serial.print(", "); Serial.print(buffer[temp+1]);  Serial.print(", "); Serial.println(buffer[temp+2]);
                }
                */

                currSlaveId = static_cast<int>(x / VOXEL_MODULE_X_SIZE) * zSize + static_cast<int>(z / VOXEL_MODULE_Z_SIZE);
                //Serial.printlnf("Assembling data for Slave ID=%i", currSlaveId);
                FlatVoxelVec& slaveVoxels = voxelModel.getSlaveVoxels(currSlaveId);
                slaveVoxels.insert(slaveVoxels.end(), &this->buffer[bufferIdxCount], &this->buffer[bufferIdxCount] + READ_BUFFER_SIZE);
                bufferIdxCount += READ_BUFFER_SIZE;
              }
            }
          }

          // Send the parsed voxel data out to the slaves
          noError = this->slavePacketWriter.writeVoxelsAll(voxelModel);
          this->setState(PacketReader::READING_END, voxelModel);
          break;
        }

        case VOXEL_DATA_CLEAR_TYPE:
          Serial.println("Reading clear voxel data packet body.");
          // Just reading 3 bytes (3x8-bit values) for the clear colour RGB
          
          noError = this->slavePacketWriter.writeVoxelsClear(voxelModel, this->buffer[0], this->buffer[1], this->buffer[2]);
          this->setState(PacketReader::READING_END, voxelModel);
          break;

        default:
          break;
      }
      break;
    }

    default:
      Serial.println("Packet type not found!");
      this->reset(voxelModel);
      break;
  }

  return noError;
}