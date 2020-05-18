#pragma once
#undef max
#undef min

#include "voxel.h"

#include <vector>
#include <PacketSerial.h>

// Serial Protocol Constants and Variables ***********************************************
#define BUFFER_QTY 10
#define PACKET_BUFFER_MAX_SIZE ((VOXEL_MODULE_X_SIZE * VOXEL_MODULE_Z_SIZE * MAX_VOXEL_Y_SIZE * 3 + 2) * BUFFER_QTY) // This will need to be large in order to support fast frame rates for large arrays
#define PACKET_SERIAL_BAUD 4608000 // highest possible baud rate for the teensy

// Packet Header/Identifier Constants
#define WELCOME_HEADER 'W'
#define VOXEL_DATA_ALL_TYPE   'A'

namespace led3d {
  typedef PacketSerial_<COBS, 0, PACKET_BUFFER_MAX_SIZE> LED3DPacketSerial;
};

// DEPRECATED ============================================================================
#define VOXEL_DATA_HEADER 'D'
#define PACKET_END_CHAR ';'

// Discovery (UDP Multicast) Constants and Variables *************************************
#define UDP_DISCOVERY_PORT 20000

// The multicast address is "233.255.255.255"
#define MULTICAST_DISCOVERY_ADDR0 233
#define MULTICAST_DISCOVERY_ADDR1 255
#define MULTICAST_DISCOVERY_ADDR2 255
#define MULTICAST_DISCOVERY_ADDR3 255

#define DISCOVERY_REQ "REQ"
#define DISCOVERY_ACK "ACK"
#define DISCOVERY_ACK_PACKET_MIN_SIZE 13
#define DISCOVERY_ACK_PACKET_MAX_SIZE 25

#define UDP_DATA_PORT 20002

#define MULTICAST_DATA_ADDR0 234
#define MULTICAST_DATA_ADDR1 255
#define MULTICAST_DATA_ADDR2 255
#define MULTICAST_DATA_ADDR3 255
// END DEPRECATED =========================================================================
