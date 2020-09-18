import FluidGPU from "./FluidGPU";

const PRESSURE_PER_FRAME_LOOPS = 12;

class LiquidGPU extends FluidGPU {
  constructor(gridSize, gpuManager) {
    super(gridSize, gpuManager);
    const NPLUS2 = this.N+2;

    this.mass = 1; // Mass per cell unit
    this.gravity = 9.81; // Force of gravity, continuously applied to the liquid
    this.confinementScale = 0.12;
    this.levelEpsilon = 0.1;
    this.decay = 1;

    this.gpuManager.initLiquidKernels(this.N);

    // Velocity buffers (Array3D(3))
    this.vel0 = this.gpuManager.initFluidBuffer3Func(0, 0, 0);
    this.vel  = this.gpuManager.initFluidBuffer3Func(0, 0, 0);
    // Pressure buffer
    this.pressure = this.gpuManager.initFluidBufferFunc(0);
    // Level-set buffer - keeps track of the signed distance between the water and air interface,
    // when < 0 we are in water, > 0 we are in air, 0 is the interface
    this.levelSet  = this.gpuManager.initFluidBufferFunc(NPLUS2*NPLUS2);
    // Temporary buffers for scalar and vector projection
    this.tempScalarBuf = this.gpuManager.initFluidBufferFunc(0);
    this.tempVec3Buf   = this.gpuManager.initFluidBuffer3Func(0, 0, 0);
  }

  injectSphere(center=[1 + this.N/2, this.N-4, 1 + this.N/2], radius=3) {
    let temp = this.levelSet;
    this.levelSet = this.gpuManager.injectLiquidSphere(center, radius, this.levelSet, this.boundaryBuf);
    temp.delete();
  }

  avectLevelSet(dt) {
    let temp = this.levelSet;
    this.levelSet = this.gpuManager.avectLiquidLevelSet(dt, this.vel0, this.levelSet, this.boundaryBuf, this.decay);
    temp.delete();
  }

  avectVelocity(dt) {
    let temp = this.vel;
    this.vel = this.gpuManager.avectLiquidVelocity(dt, this.vel0, this.boundaryBuf);
    temp.delete();
  }

  applyVorticityConfinement(dt) {
    let temp = this.tempVec3Buf;
    this.tempVec3Buf = this.gpuManager.applyLiquidVorticity(this.vel);
    temp.delete();

    temp = this.vel;
    this.vel = this.gpuManager.applyLiquidConfinement(dt, this.confinementScale, this.tempVec3Buf, this.vel);
    temp.delete();
  }

  applyExternalForces(dt) {
    // NOTE: We only apply forces to the liquid (i.e., when levelSet[x][y][z] < this.levelEpsilon)!
    const force = [3,-this.gravity,0];
    let temp = this.vel;
    this.vel = this.gpuManager.applyExternalForcesToLiquid(
      dt, this.mass, force, this.vel, this.levelSet, this.levelEpsilon, this.boundaryBuf
    );
    temp.delete();
  }

  computeVelocityDivergence() {
    let temp = this.tempScalarBuf;
    this.tempScalarBuf = this.gpuManager.computeLiquidVelDiv(this.vel, this.boundaryBuf);
    temp.delete();
  }

  computePressure(numIter=PRESSURE_PER_FRAME_LOOPS) {
    // Set the pressure outside the liquid to zero
    let temp = this.pressure;
    this.pressure = this.gpuManager.liquidLevelSetPressure(this.pressure, this.levelSet);
    temp.delete();

    for (let i = 0; i < numIter; i++) {
      temp = this.pressure;
      this.pressure = this.gpuManager.jacobiLiquid(this.pressure, this.tempScalarBuf, this.boundaryBuf, this.levelSet);
      temp.delete();
    }
  }

  projectVelocity() {
    let temp = this.vel0;
    this.vel0 = this.gpuManager.projectLiquid(this.pressure, this.vel, this.boundaryBuf);
    temp.delete();
  }

  step(dt) {
    // TODO: We need to satisfy dt <= dx / (max(u,v,w)), i.e., dt <= (1/NPLUS2) / (max(velocity))
    dt = Math.min(0.1, dt); 
    this.avectLevelSet(dt);
    this.avectVelocity(dt);
    this.applyVorticityConfinement(dt);
    this.applyExternalForces(dt);
    this.computeVelocityDivergence();
    this.computePressure();
    this.projectVelocity();
  }
}

export default LiquidGPU;