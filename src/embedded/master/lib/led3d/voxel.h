#pragma once

// Slave-related Constants ---------------------------------------------------------------------------
/*
 * The following is the layout of the LED base:
 *        ________________
 *       /               /
 *    z /               /
 *     /               /
 *    /               /
 *    ----------------
 *          x  
 *
 * If you were to then draw the vertical axis it would be the y-axis coming off the ground towards the sky,
 * these represent the vertical columns.
 *
 * All axes run from index 0 to VOXEL_MODULE_*_SIZE-1, where * is the specific axis. Each index of the x-axis represents a single strip
 * on an OCTOWS2811, therefore each module should only have a maximum of 8 indices for the x-axis (if it's using a teensy with an OCTOWS2811).
 */

#define VOXEL_MODULE_X_SIZE 8 // NOTE: If we're using OCTOWS2811 then this MUST be 8 - each teensy will represent a single slave/module
// NOTE: We don't use a Y size because this is variable and the master board will let us know how high the voxel structure is
#define VOXEL_MODULE_Z_SIZE 8 // How deep the voxel grid is (in LED vertical-columns)

class Voxel {
  public:
    Voxel(): r(0),g(0),b(0) {};
    ~Voxel() {};

    void setRGB(const uint8_t& r, const uint8_t& g, const uint8_t& b) { this->r = r; this->g = g; this->b = b; };

    uint8_t r,g,b;
};