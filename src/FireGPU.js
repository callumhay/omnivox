import FluidGPU from './FluidGPU';

const DIFFUSE_PER_FRAME_LOOPS = 12; 
const PROJECT_PER_FRAME_LOOPS = 16;

class FireGPU extends FluidGPU {
  constructor(gridSize, gpuManager, initVel=[0,0.5,0]) {
    super(gridSize, gpuManager);

    const NPLUS2 = this.N+2;

    this.diffusion = 0;
    this.viscosity = 0;
    this.cooling = 0;
    this.buoyancy = 0;
    this.vc_eps = 0;

    this.gpuManager.initFireKernels(this.N);

    // Density source buffer
    this.sd = FluidGPU.build3dBuffer(NPLUS2);
    // Density result buffers
    this.d = this.gpuManager.initFluidBufferFunc(0);
    this.d0 = this.gpuManager.initFluidBufferFunc(0);
    // xyz velocity buffers
    this.uvw = this.gpuManager.initFluidBuffer3Func(initVel[0], initVel[1], initVel[2]);
    this.uvw0 = this.gpuManager.initFluidBuffer3Func(0, 0, 0);

    // Temperature source buffer
    this.sT = FluidGPU.build3dBuffer(NPLUS2);
    // Temperature result buffers
    this.T = this.gpuManager.initFluidBufferFunc(0);
    this.T0 = this.gpuManager.initFluidBufferFunc(0);
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
    this.T0 = this.gpuManager.vorticityConfinementStep1Func(this.uvw0);
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
    this.uvw = this.gpuManager.advect3Func(this.uvw0, this.uvw, dt0, this.boundaryBuf);
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