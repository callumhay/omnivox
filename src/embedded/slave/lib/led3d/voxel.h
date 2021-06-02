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
 * Number of data pins on the OCTOWS2811: 
 * NUM_OCTO_PINS = 8
 * 
 * LED Strip index per slave: 
 * SLAVE_STRIP_IDX = (x % NUM_OCTO_PINS)
 * 
 * Slave index (also the SLAVE_ID): 
 * SLAVE_IDX = (x / NUM_OCTO_PINS)
 * 
 * LED index (from the cube's x,y,z coordinates):
 * LED_IDX = SLAVE_STRIP_IDX*voxelCubeSize*voxelCubeSize + z*voxelCubeSize + y
 * 
 * If you were to then draw the vertical axis it would be the y-axis coming off the ground towards the sky,
 * these represent the vertical columns.
 *
 * Each index of the x-axis represents a single strip on an OCTOWS2811, therefore each module should only have 
 * a maximum of 8 indices for the x-axis (if it's using a Teensy with an OCTOWS2811).
 * 
 */

#define DEFAULT_VOXEL_CUBE_SIZE 16
#define MAX_VOXEL_CUBE_SIZE 16
