#include <OctoWS2811.h>

#include "../lib/led3d/voxel.h"
#include "../lib/led3d/comm.h"

#define BOOL_TO_STRING(b) (b ? "true" : "false")

#define DEBUG_SERIAL Serial
#define DATA_SERIAL Serial1
#define MY_SLAVE_ID 1


#define RX_PIN 0
#define TX_PIN 1
#define CTS_PIN 18
#define RTS_PIN 17
#define TRANSMIT_ENABLE_PIN 22
#define FRAME_SYNC_PIN 12

led3d::LED3DPacketSerial myPacketSerial;

#define STATUS_UPDATE_FRAMES 400

static int lastKnownFrameId = -1;
static uint32_t lastFrameTimeMicroSecs = 0;
static uint32_t frameDiffMicroSecs = 0;
static int statusUpdateFrameCounter = 0;


// OCTOWS2811 Constants/Variables *******************************************************
const int octoConfig = WS2811_800kHz; // All other settings are done on the server/computer that feeds the data

const int voxelCubeSize = DEFAULT_VOXEL_CUBE_SIZE;
const int ledsPerModule = NUM_OCTO_PINS * voxelCubeSize * voxelCubeSize;
const int ledsPerStrip  = voxelCubeSize * voxelCubeSize;
const int memBuffLen = ledsPerStrip*6;

DMAMEM int displayMemory[memBuffLen] = {0};
int drawingMemory[memBuffLen] = {0};

OctoWS2811 leds(ledsPerStrip, displayMemory, drawingMemory, octoConfig);
// **************************************************************************************

void reinit(uint8_t cubeSize, bool force=false) {
  lastKnownFrameId = -1;
  statusUpdateFrameCounter = 0;
  lastFrameTimeMicroSecs = 0;

  if (cubeSize != voxelCubeSize) {
    DEBUG_SERIAL.print("Invalid cube size, this board was designed to drive a cube size of "); Serial.println(voxelCubeSize);
    return;
  }
}

void readWelcomeHeader(const uint8_t* buffer, size_t size, size_t startIdx) {
  DEBUG_SERIAL.printf("[Slave %i] Welcome Header / Init data recieved on slave.", MY_SLAVE_ID); DEBUG_SERIAL.println();
  if (size >= 1) {
    // There's only one byte and it defines the y module size
    uint8_t newCubeSize = buffer[startIdx];
    if (newCubeSize > 0) {
      reinit(newCubeSize);
    }
    else {
      DEBUG_SERIAL.printf("[Slave %i] ERROR: Received module cube side that was zero, ignoring.", MY_SLAVE_ID); DEBUG_SERIAL.println();
    }
  }
  lastKnownFrameId = -1;
}

int getFrameId(const uint8_t* buffer, size_t size) {
  return size > 3 ? static_cast<uint16_t>((buffer[2] << 8) + buffer[3]) : 0;
}

void readFullVoxelData(const uint8_t* buffer, size_t size, size_t startIdx, int frameId) {
  bool validSize = static_cast<int>(size) >= 3*ledsPerModule;
  bool validFrameOrdering = frameId > lastKnownFrameId || (frameId >= 0 && lastKnownFrameId >= 0xFFF0);
  if (validSize && validFrameOrdering) {

    // Copy directly into drawing memory.
    memcpy((uint8_t*)drawingMemory, &buffer[startIdx], sizeof(drawingMemory));

    //DEBUG_SERIAL.printf("Buffer: %i %i %i", buffer[startIdx], buffer[startIdx+1], buffer[startIdx+2]); DEBUG_SERIAL.println();
    // Sanity Testing
    //int color = ((buffer[startIdx] & 0x0000FF) << 16)  + ((buffer[startIdx+1] & 0x0000FF) << 8) + (buffer[startIdx+2] & 0x0000FF);
    //leds.setPixel(0, color);

    leds.show();

    uint32_t currMicroSecs = micros();
    if (lastFrameTimeMicroSecs != 0) {
      if (currMicroSecs > lastFrameTimeMicroSecs) {
        frameDiffMicroSecs = currMicroSecs-lastFrameTimeMicroSecs;
      }
    } 
    lastFrameTimeMicroSecs = currMicroSecs;
  }
  else {
    DEBUG_SERIAL.printf("[Slave %i] Throwing out frame %i [valid size: %s, valid frame ordering: %s]", MY_SLAVE_ID, frameId, BOOL_TO_STRING(validSize), BOOL_TO_STRING(validFrameOrdering));
    DEBUG_SERIAL.println();
    if (!validSize) {
      DEBUG_SERIAL.printf("[Slave %i] Frame size was %i, expected %i", MY_SLAVE_ID, size, 3*ledsPerModule); DEBUG_SERIAL.println();
    }
    if (!validFrameOrdering) {
      DEBUG_SERIAL.printf("[Slave %i] Previous Tracked Frame ID: %i, Current Frame ID: %i", MY_SLAVE_ID, lastKnownFrameId, frameId); DEBUG_SERIAL.println();
    }
  }
  lastKnownFrameId = frameId;

  /*
  // Debug/Info status update
  statusUpdateFrameCounter++;
  if (statusUpdateFrameCounter % STATUS_UPDATE_FRAMES == 0) {
     DEBUG_SERIAL.printf("[Slave %i] LED Refresh FPS: %.2f, Frame#: %i", MY_SLAVE_ID, (1000000.0f/((float)frameDiffMicroSecs)), lastKnownFrameId); 
     DEBUG_SERIAL.println();
     statusUpdateFrameCounter = 0;
  }
  */
}

void onSerialPacketReceived(const void* sender, const uint8_t* buffer, size_t size) {
  if (sender == &myPacketSerial && size > 2) {
    
    // The first byte of the buffer has the ID of the slave that it's relevant to
    int bufferIdx = 0; 
    uint8_t slaveId = buffer[bufferIdx++];
    if (slaveId != MY_SLAVE_ID && slaveId != EMPTY_SLAVE_ID) {
      // Ignore
      return;
    }

    // The second byte of the buffer describes the type of data, the rest will be the data itself
    switch (static_cast<char>(buffer[bufferIdx++])) {

      case WELCOME_HEADER:
        if (slaveId == EMPTY_SLAVE_ID) {
          // The server is saying hi for the first time after connecting, we should respond with our Slave ID
          char tempBuffer[12];
          snprintf(tempBuffer, 12, "SLAVE_ID %d\n", MY_SLAVE_ID);
          myPacketSerial.send((const uint8_t*)tempBuffer, sizeof(tempBuffer));
        }
        else {
          readWelcomeHeader(buffer, static_cast<size_t>(size-bufferIdx), bufferIdx);
        }
        break;

      /*
      case GOODBYE_HEADER:
        // Clear the display buffer / drawing memory
        memcpy((uint8_t*)drawingMemory, 0, sizeof(drawingMemory));
        leds.show();

        // Re/De-initialize variables
        lastKnownFrameId = -1;
        lastFrameTimeMicroSecs = 0;
        frameDiffMicroSecs = 0;
        statusUpdateFrameCounter = 0;

        DEBUG_SERIAL.printf("[Slave %i] Goodbye header received, bye!", MY_SLAVE_ID); DEBUG_SERIAL.println();
        break;
      */

      case VOXEL_DATA_ALL_TYPE:
        bufferIdx += 2; // Frame ID
        readFullVoxelData(buffer, static_cast<size_t>(size-bufferIdx), bufferIdx, getFrameId(buffer, size));
        break;

      default:
        DEBUG_SERIAL.println("Unspecified packet recieved on slave.");
        break;
    }
  }
}

void setup() {
  //TODO: pinMode(FRAME_SYNC_PIN, INPUT_PULLUP); // Frame Sync

  // Serial for receiving render data
  DEBUG_SERIAL.begin(USB_SERIAL_BAUD);
  
  //DATA_SERIAL.setRX(RX_PIN);
  //DATA_SERIAL.setTX(TX_PIN);
  DATA_SERIAL.transmitterEnable(TRANSMIT_ENABLE_PIN);
  DATA_SERIAL.begin(HW_SERIAL_BAUD);
  DATA_SERIAL.attachCts(CTS_PIN);
  DATA_SERIAL.attachRts(RTS_PIN);

  myPacketSerial.setStream(&DATA_SERIAL);
  myPacketSerial.setPacketHandler(&onSerialPacketReceived);

  leds.begin();
  leds.show();
}

void loop() {
  // Update from incoming serial data
  myPacketSerial.update();
  if (myPacketSerial.overflow()) {
    DEBUG_SERIAL.println("Serial buffer overflow.");
  }
}
