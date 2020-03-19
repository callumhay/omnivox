#include <OctoWS2811.h>

#include "common/voxel.h"
#include "common/comm.h"

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
const int ledsPerStrip = VOXEL_MODULE_Y_SIZE * VOXEL_MODULE_Z_SIZE;

DMAMEM int displayMemory[ledsPerStrip*6];
int drawingMemory[ledsPerStrip*6];

OctoWS2811 leds(ledsPerStrip, displayMemory, drawingMemory, octoConfig);
volatile bool ledsUpdated = false;
LED3DPacketSerial myPacketSerial;

void readFullVoxelData(const uint8_t* buffer, size_t size, size_t startIdx) {

  // The buffer contains data as a continuous array of voxels with 3 bytes in RGB order
  // The ordering of the coordinates system is x,y,z; each indexed from zero, where 
  // x defines the strip
  // y defines the height off the ground
  // z defines the column depth

  int dataCopySize = static_cast<int>(min(sizeof(drawingMemory), size));

  /*
  Serial.print("Full data recieved on slave. Data size:");
  Serial.println(dataCopySize);
  Serial.print("Divisible by 3? ");
  Serial.println(dataCopySize % 3 == 0 ? "Yes" : "No");
  */

  if (dataCopySize % 3 == 0) {
    unsigned int currIdx = 0;
    for (int i = 0; i < dataCopySize; i += 3) {
      int currColour = (buffer[static_cast<int>(startIdx) + i]<<16) + (buffer[static_cast<int>(startIdx) + i+1]<<8) + buffer[static_cast<int>(startIdx) + i+2];
      leds.setPixel(currIdx, gammaMapColour(currColour));
      currIdx++;
    }
    ledsUpdated = true;
  }
}
void readPartialVoxelData(const uint8_t* buffer, size_t size, size_t startIdx) {
  Serial.println("Partial data recieved on slave.");
}
void readWipeVoxelData(const uint8_t* buffer, size_t size, size_t startIdx) {
  Serial.println("Wipe data recieved on slave.");
}

void onSerialPacketReceived(const void* sender, const uint8_t* buffer, size_t size) {
  if (size > 0) {
    // The first byte of the buffer describes the type of data, the rest will be the data itself
    switch (static_cast<int>(buffer[0])) {
      
      case INIT_DATA:
        Serial.println("Init data recieved on slave.");
        break;
      
      case FULL_VOXEL_DATA:
        readFullVoxelData(buffer, static_cast<size_t>(size-1), 1);
        break;
      case PARTIAL_VOXEL_DATA:
        readPartialVoxelData(buffer, static_cast<size_t>(size-1), 1);
        break;
      case WIPE_VOXEL_DATA:
        readWipeVoxelData(buffer, static_cast<size_t>(size-1), 1);
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
  // USB (Debugging) Serial
  Serial.begin(9600);

  // Slave comm serial for receiving render data
  Serial1.begin(PACKET_SERIAL_BAUD);
  myPacketSerial.setStream(&Serial1);
  myPacketSerial.setPacketHandler(&onSerialPacketReceived);

  // Start up the LEDs
  leds.begin();
  //leds.show();

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
      leds.show();
      ledsUpdated = false;
    }
    timeCounterMicroSecs = 0;
  }
}
