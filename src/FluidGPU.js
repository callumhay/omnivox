const DEFAULT_BOUNDARY_CONFIG = {
  posXOffset:-1,negXOffset:-1,posYOffset:-1,negYOffset:-1,posZOffset:-1,negZOffset:-1
};

class FluidGPU {
  constructor(gridSize, gpuManager) {
    this.N = gridSize;
    this.dx = this.dy = this.dz = 1;
    this.gpuManager = gpuManager;
    this.gpuManager.initFluidKernels(this.N);

    // Boundary buffer (non-zero where there are solid obstacles)
    this.setBoundary();
  }

  setBoundary(config=DEFAULT_BOUNDARY_CONFIG) {
    this.boundaryBuf = FluidGPU.build3dBoundaryBuffer(this.N+2, config);
  }

  static build3dBoundaryBuffer(size, config=DEFAULT_BOUNDARY_CONFIG) {

    const {posXOffset,negXOffset,posYOffset,negYOffset,posZOffset,negZOffset} = config;
    const result = FluidGPU.build3dBuffer(size);
    const 
      bStartX = Math.max(0,negXOffset), bEndX = size-1-Math.max(0,posXOffset),
      bStartY = Math.max(0,negYOffset), bEndY = size-1-Math.max(0,posYOffset),
      bStartZ = Math.max(0,negZOffset), bEndZ = size-1-Math.max(0,negZOffset);

    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (negXOffset >= 0) { for (let x = 0; x <= bStartX; x++) { result[x][y][z] = 1; }}
        if (posXOffset >= 0) { for (let x = size-1; x >= bEndX; x--) { result[x][y][z] = 1; }}
      }
    }
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        if (negYOffset >= 0) { for (let y = 0; y <= bStartY; y++) { result[x][y][z] = 1; }}
        if (posYOffset >= 0) { for (let y = size-1; y >= bEndY; y--) { result[x][y][z] = 1; }}
      }
    }
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (negZOffset >= 0) { for (let z = 0; z <= bStartZ; z++) { result[x][y][z] = 1; }}
        if (posZOffset >= 0) { for (let z = size-1; z >= bEndZ; z--) { result[x][y][z] = 1; }}
      }
    }
    return result;
  }

  static build3dBuffer(size) {
    const result = new Array(size);
    for (let x = 0; x < size; x++) {
      const xArr = new Array(size);
      result[x] = xArr;
      for (let y = 0; y < size; y++) {
        const yArr = new Array(size).fill(0);
        xArr[y] = yArr;
      }
    }
    return result
  }
}
export default FluidGPU;