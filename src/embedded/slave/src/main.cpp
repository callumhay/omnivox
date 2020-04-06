#include <OctoWS2811.h>

#include "../../master/lib/led3d/voxel.h"
#include "../../master/lib/led3d/comm.h"

// Gamma correction for Neopixel LED strips - maps each of R, G, and B from uint8 value 
// to a gamma corrected uint8 value ****************************************************
const uint8_t PROGMEM gamma8[] = {
    0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
    0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  1,  1,  1,  1,
    1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  2,  2,  2,  2,  2,  2,
    2,  3,  3,  3,  3,  3,  3,  3,  4,  4,  4,  4,  4,  5,  5,  5,
    5,  6,  6,  6,  6,  7,  7,  7,  7,  8,  8,  8,  9,  9,  9, 10,
   10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16,
   17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24, 25,
   25, 26, 27, 27, 28, 29, 29, 30, 31, 32, 32, 33, 34, 35, 35, 36,
   37, 38, 39, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 50,
   51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68,
   69, 70, 72, 73, 74, 75, 77, 78, 79, 81, 82, 83, 85, 86, 87, 89,
   90, 92, 93, 95, 96, 98, 99,101,102,104,105,107,109,110,112,114,
  115,117,119,120,122,124,126,127,129,131,133,135,137,138,140,142,
  144,146,148,150,152,154,156,158,160,162,164,167,169,171,173,175,
  177,180,182,184,186,189,191,193,196,198,200,203,205,208,210,213,
  215,218,220,223,225,228,231,233,236,239,241,244,247,249,252,255 
};

int gammaMapColour(int colour) {
  return (static_cast<int>(pgm_read_byte(&gamma8[colour >> 16 & 0x0000FF])) << 16) | 
         (static_cast<int>(pgm_read_byte(&gamma8[colour >>  8 & 0x0000FF])) << 8)  | 
          static_cast<int>(pgm_read_byte(&gamma8[colour & 0x0000FF]));
}

// OCTOWS2811 Constants/Variables *******************************************************
const int octoConfig = WS2811_GRB | WS2811_800kHz;

int voxelModuleYSize = 0;
int ledsPerStrip = voxelModuleYSize * VOXEL_MODULE_Z_SIZE;
int ledsPerModule = VOXEL_MODULE_X_SIZE * voxelModuleYSize * VOXEL_MODULE_Z_SIZE;

DMAMEM int* displayMemory = NULL;
int* drawingMemory = NULL;
OctoWS2811* leds = NULL;
// **************************************************************************************

const int MY_SLAVE_ID = 0;
volatile bool ledsUpdated = false;
led3d::LED3DPacketSerial myPacketSerial;

void reinit(uint8_t ySize) {
  if (ySize != voxelModuleYSize) {

    voxelModuleYSize = ySize;
    ledsPerStrip = voxelModuleYSize * VOXEL_MODULE_Z_SIZE;
    ledsPerModule = VOXEL_MODULE_X_SIZE * voxelModuleYSize * VOXEL_MODULE_Z_SIZE;

    if (displayMemory != NULL) {
      delete[] displayMemory;
      displayMemory = NULL;
    }
    displayMemory = new int[ledsPerStrip*6];
    
    if (drawingMemory != NULL) {
      delete[] drawingMemory;
      drawingMemory = NULL;
    }
    drawingMemory = new int[ledsPerStrip*6];

    if (leds != NULL) {
      delete leds;
      leds = NULL;
    }
    leds = new OctoWS2811(ledsPerStrip, displayMemory, drawingMemory, octoConfig);
    leds->begin();
  }
}

void readWelcomeHeader(const uint8_t* buffer, size_t size, size_t startIdx) {
  Serial.println("Welcome Header / Init data recieved on slave.");
  if (size >= 1) {
    // There's only one byte and it defines the y module size
    reinit(buffer[startIdx]);
  }
}

void readFullVoxelData(const uint8_t* buffer, size_t size, size_t startIdx) {

  // The buffer contains data as a continuous array of voxels with 3 bytes in RGB order
  // The ordering of the coordinates system is x,y,z; each indexed from zero, where 
  // x defines the strip
  // y defines the height off the ground
  // z defines the column depth

  if (static_cast<int>(size) >= ledsPerModule) {

    int bufferIdx = 0;
    for (int x = 0; x < VOXEL_MODULE_X_SIZE; x++) {
      for (int y = 0; y < voxelModuleYSize; y++) {
        for (int z = 0; z < VOXEL_MODULE_Z_SIZE; z++) {
          // Each colour is encoded as 3 bytes in the buffer (RGB)
          int currColour = (buffer[static_cast<int>(startIdx) + bufferIdx]   << 16) + 
                           (buffer[static_cast<int>(startIdx) + bufferIdx+1] << 8) + 
                           (buffer[static_cast<int>(startIdx) + bufferIdx+2]);
          bufferIdx += 3;

          // Every x we move moves us to a new wire on the octo (goes through ySize*zSize LEDs)
          // Every y we move goes up the current wire on the octo by a single LED
          // Every z we move jumps through the same wire on the octo by ySize LEDs
          leds->setPixel(x*voxelModuleYSize*VOXEL_MODULE_Z_SIZE + z*voxelModuleYSize + y, gammaMapColour(currColour));
        }
      }
    }
    ledsUpdated = true;
  }
}

void readWipeVoxelData(const uint8_t* buffer, size_t size, size_t startIdx) {
  Serial.println("Clear colour data recieved on slave.");
  if (size >= 3) {
    // Go through every LED in wipe it's colour to given one
    int bufferIdx = 0;
    for (int i = 0; i < ledsPerModule; i++) {
      // Each colour is encoded as 3 bytes in the buffer (RGB)
      int currColour = (buffer[static_cast<int>(startIdx) + bufferIdx]   << 16) + 
                        (buffer[static_cast<int>(startIdx) + bufferIdx+1] << 8) + 
                        (buffer[static_cast<int>(startIdx) + bufferIdx+2]);
      bufferIdx += 3;

      leds->setPixel(i, gammaMapColour(currColour));
    }
    ledsUpdated = true;
  }
}

void onSerialPacketReceived(const void* sender, const uint8_t* buffer, size_t size) {

  if (sender == &myPacketSerial && size > 2) {

    // The first byte of the buffer has the ID of the slave that it's relevant to
    int slaveId = static_cast<int>(buffer[0]);
    if (slaveId != MY_SLAVE_ID) {
      // Ignore
      return;
    }

    // The second byte of the buffer describes the type of data, the rest will be the data itself
    switch (static_cast<int>(buffer[1])) {
      
      case WELCOME_HEADER:
        readWelcomeHeader(buffer, static_cast<size_t>(size-2), 2);
        break;

      case VOXEL_DATA_ALL_TYPE:
        readFullVoxelData(buffer, static_cast<size_t>(size-2), 2);
        break;

      case VOXEL_DATA_CLEAR_TYPE:
        readWipeVoxelData(buffer, static_cast<size_t>(size-2), 2);
        break;
        
      default:
        Serial.println("Unspecified packet recieved on slave.");
        break;
    }
  }
}

static const int REFRESH_RATE_HZ = 60;
static const unsigned long numMicroSecsPerRefresh = 1000000/REFRESH_RATE_HZ;
static unsigned long timeCounterMicroSecs = 0;

void setup() {
  reinit(VOXEL_MODULE_X_SIZE);

  // USB (Debugging) Serial
  Serial.begin(9600);

  // Slave comm serial for receiving render data
  Serial1.begin(PACKET_SERIAL_BAUD);
  myPacketSerial.setStream(&Serial1);
  myPacketSerial.setPacketHandler(&onSerialPacketReceived);

  timeCounterMicroSecs = 0;
  ledsUpdated = false;
}

void loop() {
  static unsigned long lastTimeInMicroSecs = micros();
  
  unsigned long currTimeMicroSecs = micros();
  unsigned long dtMicroSecs = currTimeMicroSecs - lastTimeInMicroSecs;
  lastTimeInMicroSecs = currTimeMicroSecs;
  
  myPacketSerial.update();

  // Synchronize updates to the specified REFRESH_RATE_HZ
  timeCounterMicroSecs += dtMicroSecs;
  if (timeCounterMicroSecs >= numMicroSecsPerRefresh) {
    if (ledsUpdated) {
      leds->show();
      ledsUpdated = false;
    }
    timeCounterMicroSecs = 0;
  }
}
