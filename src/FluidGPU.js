const DIFFUSE_PER_FRAME_LOOPS = 12; 
const PROJECT_PER_FRAME_LOOPS = 16;

class FluidGPU {
  constructor(gridSize, gpuManager) {
    this.N = gridSize;
    const NPLUS2 = this.N+2;

    this.diffusion = 0;
    this.viscosity = 0;
    this.cooling   = 0;
    this.buoyancy  = 0;
    this.vc_eps    = 0;

    this.gpuManager = gpuManager;
    this.gpuManager.initFluidKernels(this.N);

    const build3dBuffer = (size) => {
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

    // Density and temperature source buffers
    this.sd = build3dBuffer(NPLUS2);
    this.sT = build3dBuffer(NPLUS2);
    // Density and temperature result buffers
    this.d = this.gpuManager.initFluidBufferFunc(0); this.d0 = this.gpuManager.initFluidBufferFunc(0);
    this.T = this.gpuManager.initFluidBufferFunc(0); this.T0 = this.gpuManager.initFluidBufferFunc(0);
    // xyz velocity buffers
    this.uvw  = this.gpuManager.initFluidBuffer3Func(0, 0.5, 0);
    this.uvw0 = this.gpuManager.initFluidBuffer3Func(0, 0, 0);
  }

  addSource(srcBuffer, dstBuffer, dt) {
    const temp = dstBuffer;
    const result = this.gpuManager.addFluidSourceFunc(srcBuffer, dstBuffer, dt);
    temp.delete();
    return result;
  }

  addBuoyancy(dt) {
    const temp = this.uvw;
    this.uvw = this.gpuManager.addBuoyancyFunc(this.T, this.uvw, this.buoyancy*dt);
    temp.delete();
  }

  diffuse3(dt) {
    let temp = null;
    const a = dt * this.viscosity * this.N * this.N * this.N;
    for (let l = 0; l < DIFFUSE_PER_FRAME_LOOPS; l++) {
      temp = this.uvw;
      this.uvw = this.gpuManager.diffuseStep3Func(this.uvw0, this.uvw, a);
      temp.delete();
    }
  }
  diffuse(x0, x, diff, dt) {
    let temp = null;
    let result = x;
    const a = dt * diff * this.N * this.N * this.N;
    for (let l = 0; l < DIFFUSE_PER_FRAME_LOOPS; l++) {
      temp = result;
      result = this.gpuManager.diffuseStepFunc(x0, result, a);
      temp.delete();
    }
    return result;
  }

  advect3(dt) {
    const dt0 = dt*this.N;
    let temp = this.uvw;
    this.uvw = this.gpuManager.advectCool3Func(this.uvw0, this.uvw, dt0);
    temp.delete();
  }

  advect(x0, x, uuvvww, dt) {
    const dt0 = dt*this.N;
    const result = this.gpuManager.advectCoolFunc(x0, x, uuvvww, dt0, 1);
    x.delete();
    return result;
  }
  _advectCoolX(x0, x, uuvvww, dt) {
    return this.advect(x0, x, uuvvww, dt);
  }
  _advectCoolY(y0, y, uuvvww, dt) {
    const dt0 = dt*this.N;
    const c0  = 1.0 - this.cooling*dt;
    const result = this.gpuManager.advectCoolFunc(y0, y, uuvvww, dt0, c0);
    y.delete();
    return result;
  }

  project() {
    let temp = this.uvw0;
    this.uvw0 = this.gpuManager.projectStep1Func(this.uvw0, this.uvw);
    temp.delete();

    for (let l = 0; l < PROJECT_PER_FRAME_LOOPS; l++) {
      temp = this.uvw0;
      this.uvw0 = this.gpuManager.projectStep2Func(this.uvw0);
      temp.delete();
    }

    temp = this.uvw;
    this.uvw = this.gpuManager.projectStep3Func(this.uvw, this.uvw0);
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

  velStep(dt, diffuse = true, advect = true) {
    this.addBuoyancy(dt);
    this.vorticityConfinement(dt);

    let temp = null;
    if (diffuse) {
      temp = this.uvw; this.uvw = this.uvw0; this.uvw0 = temp;
      this.diffuse3(dt);
      this.project();
    }
    if (advect) {
      temp = this.uvw; this.uvw = this.uvw0; this.uvw0 = temp;
      this.advect3(dt);
      this.project();
    }
  }

  densTempStep(dt) {
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
    this.velStep(dt);
    this.densTempStep(dt);
  }

}

export default FluidGPU;