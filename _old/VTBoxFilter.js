
/*
// Simple box filter for 3D convolution window.
class VTBoxFilter3D {
  constructor(samplesPerAxis, options) {
    this.samplesPerAxis = samplesPerAxis;
  }

  getWeight(boxIdx) {
    return 1.0 / Math.pow(this.samplesPerAxis,3);
  }
}

// Gaussian 3D convolution window.
class VTGaussianFilter3D {
  constructor(samplesPerAxis, options) {
    this._samplesPerAxis = samplesPerAxis;
    this.sigma = options.sigma;
    this.recomputeWindow();
  }

  get samplesPerAxis() { 
    return this._samplesPerAxis;
  }
  set samplesPerAxis(s) {
    this._samplesPerAxis = s;
    this.recomputeWindow();
  }

  recomputeWindow() {
    this._window = new Float32Array(Math.pow(this.samplesPerAxis, 3));
    
    let idx = 0;
    let total = 0;
    for (let x = 0; x < this.samplesPerAxis; x++) {
      for (let y = 0; y < this.samplesPerAxis; y++) {
        for (let z = 0; z < this.samplesPerAxis; z++) {

          const gaussianVal = (1.0 / Math.pow(Math.sqrt(2*Math.PI)*this.sigma, 3)) * Math.exp(-0.5 * Math.pow(x-0.5 + y-0.5 + z-0.5,2) / (this.sigma*this.sigma));
          this._window[idx++] = gaussianVal;
          total += gaussianVal;
        }
      }
    }

    // Normalize so that all parts of the kernel add up to 1
    for (let i = 0; i < this._window.length; i++) {
      this._window[i] /= total;
    }
  }

  getWeight(boxIdx) {
    return this._window[boxIdx];
  }
}; 

class VTUniformVoxelSampler {
  constructor(filter) {
    this.filter = filter;
  }

  getSampleBoxes(voxelIdxPt) {
    const {samplesPerAxis} = this.filter;
    const sampleSize = 1.0 / samplesPerAxis;
    const sampleBoxes = [];

    for (let x = 0; x < samplesPerAxis; x++) {
      for (let y = 0; y < samplesPerAxis; y++) {
        for (let z = 0; z < samplesPerAxis; z++) {
          let minPt = new THREE.Vector3(x*sampleSize, y*sampleSize, z*sampleSize);
          minPt.add(voxelIdxPt);
          let maxPt = new THREE.Vector3(minPt.x + sampleSize, minPt.y + sampleSize, minPt.z + sampleSize);
          sampleBoxes.push(new THREE.Box3(minPt, maxPt));
        }
      }
    }

    return sampleBoxes;
  }

  getSamplePoints(voxelIdxPt) {
    const {samplesPerAxis} = this.filter;
    const sampleSize = 1.0 / samplesPerAxis;
    const halfSampleSize = sampleSize / 2.0;
    const samplePts = [];

    for (let x = 0; x < samplesPerAxis; x++) {
      for (let y = 0; y < samplesPerAxis; y++) {
        for (let z = 0; z < samplesPerAxis; z++) {
          const currPt = new THREE.Vector3(x*sampleSize + halfSampleSize, y*sampleSize + halfSampleSize, z*sampleSize + halfSampleSize);
          currPt.add(voxelIdxPt);
          samplePts.push(currPt);
        }
      }
    }

    return samplePts;
  }

  getSampleWeight(boxIdx) {
    return this.filter.getWeight(boxIdx);
  }
}

const meshSampler = new VTUniformVoxelSampler(new VTGaussianFilter3D(3, {sigma: 1}));
*/