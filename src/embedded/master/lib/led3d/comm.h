#pragma once
#undef max
#undef min

#include <vector>
#include <PacketSerial.h>

// Serial Protocol Constants and Variables ***********************************************
#define PACKET_BUFFER_MAX_SIZE 2048
#define PACKET_SERIAL_BAUD 1000000 // N.B., At about 1000000 baud we can get about 60 Hz refresh for a buffer of 2048 bytes

// Discovery (UDP Multicast) Constants and Variables *************************************
#define UDP_PORT 20000

// The multicast address is "233.255.255.255"
#define MULTICAST_ADDR0 233
#define MULTICAST_ADDR1 255
#define MULTICAST_ADDR2 255
#define MULTICAST_ADDR3 255

#define DISCOVERY_REQ "REQ"
#define DISCOVERY_ACK "ACK"
#define DISCOVERY_ACK_PACKET_MIN_SIZE 13
#define DISCOVERY_ACK_PACKET_MAX_SIZE 25

// Packet Header/Identifier Constants - TCP ONLY
#define WELCOME_HEADER 'W'
#define VOXEL_DATA_HEADER 'D'
// Data type constants (Subheader types)
#define VOXEL_DATA_ALL_TYPE   'A'
#define VOXEL_DATA_CLEAR_TYPE 'C'

#define PACKET_END_CHAR ';'

namespace led3d {
  typedef PacketSerial_<COBS, 0, PACKET_BUFFER_MAX_SIZE> LED3DPacketSerial;
};