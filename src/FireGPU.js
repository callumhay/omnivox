const DIFFUSE_PER_FRAME_LOOPS = 12; 
const PROJECT_PER_FRAME_LOOPS = 16;

const DEFAULT_BOUNDARY_CONFIG = {
  posXOffset:-1,negXOffset:-1,posYOffset:-1,negYOffset:-1,posZOffset:-1,negZOffset:-1
};

class FireGPU {
  constructor(gridSize, gpuManager, initVel=[0,0.5,0]) {
    this.N = gridSize;
    const NPLUS2 = this.N+2;

    this.diffusion = 0;
    this.viscosity = 0;
    this.cooling = 0;
    this.buoyancy = 0;
    this.vc_eps = 0;

    this.gpuManager = gpuManager;
    this.gpuManager.initFireKernels(this.N);

    // Density source buffer
    this.sd = FireGPU.build3dBuffer(NPLUS2);
    // Density result buffers
    this.d = this.gpuManager.initFluidBufferFunc(0);
    this.d0 = this.gpuManager.initFluidBufferFunc(0);
    // xyz velocity buffers
    this.uvw = this.gpuManager.initFluidBuffer3Func(initVel[0], initVel[1], initVel[2]);
    this.uvw0 = this.gpuManager.initFluidBuffer3Func(0, 0, 0);

    // Temperature source buffer
    this.sT = FireGPU.build3dBuffer(NPLUS2);
    // Temperature result buffers
    this.T = this.gpuManager.initFluidBufferFunc(0);
    this.T0 = this.gpuManager.initFluidBufferFunc(0);

    // Boundary buffer (non-zero where there are solid obstacles)
    // For now this is just outside of the box (not visible)
    this.setBoundary();
    //this.boundaryBuf = FireGPU.build3dBuffer(NPLUS2);
  }

  static build3dBoundaryBuffer(size, config=DEFAULT_BOUNDARY_CONFIG) {

    const {posXOffset,negXOffset,posYOffset,negYOffset,posZOffset,negZOffset} = config;
    const result = FireGPU.build3dBuffer(size);
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

  setBoundary(config=DEFAULT_BOUNDARY_CONFIG) {
    this.boundaryBuf = FireGPU.build3dBoundaryBuffer(this.N+2, config);
  }
  
  addSource(srcBuffer, dstBuffer, dt) {
    const temp = dstBuffer;
    const result = this.gpuManager.addFluidSourceFunc(srcBuffer, dstBuffer, dt);
    temp.delete();
    return result;
  }

  addBuoyancy(dt) {
    const temp = this.uvw;
    this.uvw = this.gpuManager.addBuoyancyFunc(this.T, this.uvw, this.buoyancy * dt);
    temp.delete();
  }

  vorticityConfinement(dt) {
    let temp = this.uvw0;
    this.uvw0 = this.gpuManager.curlFunc(this.uvw0, this.uvw);
    temp.delete();

    temp = this.T0;
    this.T0 = this.gpuManager.vorticityConfinementStep1Func(this.T0, this.uvw0);
    temp.delete();

    const dt0 = dt * this.vc_eps;
    temp = this.uvw;
    this.uvw = this.gpuManager.vorticityConfinementStep2Func(this.uvw, this.T0, this.uvw0, dt0);
    temp.delete();
  }

  _advectCoolX(x0, x, uuvvww, dt) {
    const dt0 = dt * this.N;
    const result = this.gpuManager.advectCoolFunc(x0, x, uuvvww, dt0, 1, this.boundaryBuf);
    x.delete();
    return result;
  }
  _advectCoolY(y0, y, uuvvww, dt) {
    const dt0 = dt * this.N;
    const c0 = 1.0 - this.cooling * dt;
    const result = this.gpuManager.advectCoolFunc(y0, y, uuvvww, dt0, c0, this.boundaryBuf);
    y.delete();
    return result;
  }

  diffuse3(dt, numIter = DIFFUSE_PER_FRAME_LOOPS) {
    let temp = null;
    const a = dt * this.viscosity * this.N * this.N * this.N;
    for (let l = 0; l < numIter; l++) {
      temp = this.uvw;
      this.uvw = this.gpuManager.diffuseStep3Func(this.uvw0, this.uvw, a, this.boundaryBuf);
      temp.delete();
    }
  }
  diffuse(x0, x, diff, dt, numIter = DIFFUSE_PER_FRAME_LOOPS) {
    let temp = null;
    let result = x;
    const a = dt * diff * this.N * this.N * this.N;
    for (let l = 0; l < numIter; l++) {
      temp = result;
      result = this.gpuManager.diffuseStepFunc(x0, result, a, this.boundaryBuf);
      temp.delete();
    }
    return result;
  }

  advect3(dt) {
    const dt0 = dt*this.N;
    let temp = this.uvw;
    this.uvw = this.gpuManager.advectCool3Func(this.uvw0, this.uvw, dt0, this.boundaryBuf);
    temp.delete();
  }

  project(numIter = PROJECT_PER_FRAME_LOOPS) {
    let temp = this.uvw0;
    this.uvw0 = this.gpuManager.projectStep1Func(this.uvw0, this.uvw);
    temp.delete();

    for (let l = 0; l < numIter; l++) {
      temp = this.uvw0;
      this.uvw0 = this.gpuManager.projectStep2Func(this.uvw0);
      temp.delete();
    }

    temp = this.uvw;
    this.uvw = this.gpuManager.projectStep3Func(this.uvw, this.uvw0, this.boundaryBuf);
    temp.delete();
  }

  velocityStep(dt) {
    this.addBuoyancy(dt);
    this.vorticityConfinement(dt);

    let temp = null;
    temp = this.uvw; this.uvw = this.uvw0; this.uvw0 = temp;
    this.diffuse3(dt);
    this.project();

    temp = this.uvw; this.uvw = this.uvw0; this.uvw0 = temp;
    this.advect3(dt);
    this.project();
  }

  densityTemperatureStep(dt) {
    this.d = this.addSource(this.sd, this.d, dt);
    this.T = this.addSource(this.sT, this.T, dt);

    let temp = null;
    temp = this.d; this.d = this.d0; this.d0 = temp;
    this.d = this.diffuse(this.d0, this.d, this.diffusion, dt);

    temp = this.d; this.d = this.d0; this.d0 = temp;
    temp = this.T; this.T = this.T0; this.T0 = temp;
    this.d = this._advectCoolX(this.d0, this.d, this.uvw, dt);
    this.T = this._advectCoolY(this.T0, this.T, this.uvw, dt);
  }

  step(dt) {
    this.velocityStep(dt);
    this.densityTemperatureStep(dt);
  }
}

export default FireGPU;