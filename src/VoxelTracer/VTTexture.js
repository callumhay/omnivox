
import * as THREE from 'three';
import getPixels from 'get-pixels';
import ndarray from 'ndarray';

class VTTexture {
  constructor(imgUrl) {
    
    let self = this;
    this.imgData = null;

    getPixels(imgUrl, (err, pixels) => {
      if (err) {
        console.log("Failed to load image: " + imgUrl);
        console.log(err);
        return;
      }

      if (pixels.shape.length === 4) {
        console.log("Invalid texture dimension, scaling down...");
        pixels = pixels.pick(0);
      }
      
      /*
      console.log("Size: " + pixels.size);
      console.log("Shape: " + pixels.shape);
      console.log("Stride: " + pixels.stride);
      console.log("Offset: " + pixels.offset);
      */

      // Normalize the image data into floating point [0,1] colour data
      const fpData = ndarray(new Float32Array(pixels.size), pixels.shape, pixels.stride, pixels.offset);
      
      for (let i = 0; i < pixels.shape[0]; i++) {
        for (let j = 0; j < pixels.shape[1]; j++) {
          for (let k = 0; k < pixels.shape[2]; k++) {
            fpData.set(i,j,k, pixels.get(i,j,k)/255.0);
            //console.log(fpData.get(i,j,k));
          }
        }
      }
      self.imgData = fpData;
      /*
      for (let i = 0; i < pixels.shape[0]; i++) {
        for (let j = 0; j < pixels.shape[1]; j++) {
          console.log("r: " + self.imgData.get(i,j,0) + ", g: " + self.imgData.get(i,j,1) + ", b: " + self.imgData.get(i,j,2));
        }
      }
      */
    });
  }

  isLoaded() {
    return this.imgData !== null;
  }

  /**
   * Get a sample (i.e., an array of the channels) at the given u,v coordinates in this texture.
   */
  sample(uv) {
    if (!this.isLoaded()) {
      return null;
    }
    // NOTE: Assumption that uv coordinates are in [0,1]
    const uIdx = Math.floor(uv.x * (this.imgData.shape[0]-1));
    const vIdx = Math.floor(uv.y * (this.imgData.shape[1]-1));
    //console.log("r: " + this.imgData.get(uIdx,vIdx,0) + ", g: " + this.imgData.get(uIdx,vIdx,1) + ", b: " + this.imgData.get(uIdx,vIdx,2));
    return new THREE.Color(
      this.imgData.get(uIdx,vIdx,0),
      this.imgData.get(uIdx,vIdx,1),
      this.imgData.get(uIdx,vIdx,2)
    );
  }
}

export default VTTexture;