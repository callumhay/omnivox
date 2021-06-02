#pragma once
#undef max
#undef min

#include "voxel.h"

#include <vector>
#include <PacketSerial.h>

// Serial Protocol Constants and Variables ***********************************************
#define MAX_BUFFER_LOOKAHEAD 32
#define NUM_OCTO_PINS 8
// The serial buffer will need to be large in order to hold a full COBs encoded frame plus lookahead
#define PACKET_BUFFER_MAX_SIZE (NUM_OCTO_PINS * MAX_VOXEL_CUBE_SIZE * MAX_VOXEL_CUBE_SIZE * 3 + 4 + MAX_BUFFER_LOOKAHEAD)
#define USB_SERIAL_BAUD 9600
#define HW_SERIAL_BAUD 3000000

// Packet Header/Identifier Constants
#define WELCOME_HEADER 'W'
#define VOXEL_DATA_ALL_TYPE 'A'

#define EMPTY_SLAVE_ID 255

namespace led3d {
  typedef PacketSerial_<COBS, 0, PACKET_BUFFER_MAX_SIZE> LED3DPacketSerial;
};
