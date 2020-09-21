import FluidGPU from "./FluidGPU";

const REINIT_PER_FRAME_LOOPS   = 2;
const PRESSURE_PER_FRAME_LOOPS = 25;

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
    this.tempScalarBuf1 = this.gpuManager.initFluidBufferFunc(0);
    this.tempVec3Buf   = this.gpuManager.initFluidBuffer3Func(0, 0, 0);
  }
  
  injectSphere(center=[1 + this.N/2, this.N-4, 1 + this.N/2], radius=3) {
    let temp = this.levelSet;
    this.levelSet = this.gpuManager.injectLiquidSphere(center, radius, this.levelSet, this.boundaryBuf);
    temp.delete();
  }

  advectLevelSetBFECC(dt) {
    // Advect forward to get \phi^(n+1)
    const tempScalarBuf2 = this.gpuManager.advectLiquidLevelSet(dt, this.vel0, this.levelSet, this.boundaryBuf, 1, 1);

    // Advect back to get \bar{\phi}
    let temp = this.tempScalarBuf1;
    this.tempScalarBuf1 = this.gpuManager.advectLiquidLevelSet(dt, this.vel0, tempScalarBuf2, this.boundaryBuf, -1, 1);
    temp.delete();

    temp = this.levelSet;
    this.levelSet = this.gpuManager.advectLevelSetBFECC(dt, this.vel0, this.tempScalarBuf1, tempScalarBuf2, this.boundaryBuf, this.decay)
    temp.delete();
    tempScalarBuf2.delete();
  }

  advectLevelSet(dt) {
    let temp = this.levelSet;
    this.levelSet = this.gpuManager.advectLiquidLevelSet(dt, this.vel0, this.levelSet, this.boundaryBuf, 1, this.decay);
    temp.delete();
  }

  reinitLevelSet(dt, numIter=REINIT_PER_FRAME_LOOPS) {
    const levelSet0 = this.levelSet;
    let levelSetN = this.gpuManager.reinitLevelSet(dt, levelSet0, levelSet0, this.boundaryBuf);
    let temp = null;
    for (let i = 0; i < numIter-1; i++) {
      temp = levelSetN;
      levelSetN = this.gpuManager.reinitLevelSet(dt, levelSet0, levelSetN, this.boundaryBuf);
      temp.delete();
    }
    this.levelSet = levelSetN;
    levelSet0.delete();
  }

  advectVelocity(dt) {
    let temp = this.vel;
    this.vel = this.gpuManager.avectLiquidVelocity(dt, this.vel0, this.boundaryBuf);
    temp.delete();
  }

  applyVorticityConfinement(dt) {
    let temp = this.tempVec3Buf;
    this.tempVec3Buf = this.gpuManager.applyLiquidVorticity(this.vel, this.boundaryBuf);
    temp.delete();

    temp = this.vel;
    this.vel = this.gpuManager.applyLiquidConfinement(dt, this.confinementScale, this.tempVec3Buf, this.vel, this.boundaryBuf);
    temp.delete();
  }

  applyExternalForces(dt) {
    // NOTE: We only apply forces to the liquid (i.e., when levelSet[x][y][z] < this.levelEpsilon)!
    const force = [0,-this.gravity,0];
    let temp = this.vel;
    this.vel = this.gpuManager.applyExternalForcesToLiquid(
      dt, this.mass, force, this.vel, this.levelSet, this.levelEpsilon, this.boundaryBuf
    );
    temp.delete();
  }

  computeVelocityDivergence() {
    let temp = this.tempScalarBuf1;
    this.tempScalarBuf1 = this.gpuManager.computeLiquidVelDiv(this.vel, this.boundaryBuf);
    temp.delete();
  }

  computePressure(numIter=PRESSURE_PER_FRAME_LOOPS) {
    // Set the pressure outside the liquid to zero
    let temp = this.pressure;
    this.pressure = this.gpuManager.liquidLevelSetPressure(this.pressure, this.levelSet);
    temp.delete();

    for (let i = 0; i < numIter; i++) {
      temp = this.pressure;
      this.pressure = this.gpuManager.jacobiLiquid(this.pressure, this.tempScalarBuf1, this.boundaryBuf, this.levelSet);
      temp.delete();
    }
  }

  projectVelocity() {
    let temp = this.vel0;
    this.vel0 = this.gpuManager.projectLiquidVelocity(this.pressure, this.vel, this.boundaryBuf, this.levelSet);
    temp.delete();
  }

  step(dt) {
    dt = Math.min(dt, 0.09);

    //this.advectLevelSet(dt);
    this.advectLevelSetBFECC(dt);
    this.reinitLevelSet(dt);
    this.advectVelocity(dt);
    this.applyVorticityConfinement(dt);
    this.applyExternalForces(dt);
    this.computeVelocityDivergence();
    this.computePressure();
    this.projectVelocity();
  }

}

export default LiquidGPU;