import FluidGPU from "./FluidGPU";

const REINIT_PER_FRAME_LOOPS   = 3;
const PRESSURE_PER_FRAME_LOOPS = 30;

class LiquidGPU extends FluidGPU {
  constructor(gridSize, gpuManager) {
    super(gridSize, gpuManager);
    const NPLUS2 = this.N+2;

    this.gravity = 9; // Force of gravity, continuously applied to the liquid
    this.confinementScale = 0.12;
    this.levelEpsilon = 0.9; // The interface band between liquid and air/gas
    this.decay = 1;
    this.velAdvectionDamping = 0.0;
    this.lsAdvectionDamping = 0.0;
    this.levelSetDamping = 0.0;
    this.pressureModulation = 1.0;

    this.gpuManager.initLiquidKernels(this.N);

    // Velocity buffers (Array3D(3))
    this.vel0 = this.gpuManager.initFluidBuffer3Func(0, 0, 0);
    this.vel  = this.gpuManager.initFluidBuffer3Func(0, 0, 0);
    // Pressure buffer
    this.prevPressure = this.gpuManager.initFluidBufferFunc(0);
    this.pressure = this.gpuManager.initFluidBufferFunc(0);
    this.pressureDiff = this.gpuManager.initFluidBufferFunc(0);
    // Level-set buffer - keeps track of the signed distance between the water and air interface,
    // when < 0 we are in water, > 0 we are in air, 0 is the interface
    this.levelSet  = this.gpuManager.initFluidBufferFunc(NPLUS2*NPLUS2);
    // Temporary buffers for scalar and vector projection
    this.tempScalarBuf1 = this.gpuManager.initFluidBufferFunc(0);
    this.tempVec3Buf   = this.gpuManager.initFluidBuffer3Func(0, 0, 0);

    this.stopSimulation = false;
    this.pressureSlowdownTime = 0;
    this.numRuns = 0;
  }
  
  injectForceBlob(center, impulseStrength, size) {
    this.forceBlob = {center, impulseStrength, size};
  }

  injectSphere(center=[1 + this.N/2, this.N-4, 1 + this.N/2], radius=3) {
    let temp = this.levelSet;
    this.levelSet = this.gpuManager.injectLiquidSphere(center, radius, this.levelSet, this.boundaryBuf);
    temp.delete();
  }

  advectLevelSet(dt) {
    let temp = this.levelSet;
    this.levelSet = this.gpuManager.advectLiquidLevelSet(dt, this.vel0, this.levelSet, this.boundaryBuf, 1, 1);
    temp.delete();
  }
  advectLevelSetRK3(dt) {
    const phi1 = this.gpuManager.advectLiquidLevelSet(dt, this.vel0, this.levelSet, this.boundaryBuf, 1, 1);
    const phi2 = this.gpuManager.advectLiquidLevelSetOrder2(dt, this.vel0, this.levelSet, phi1, this.boundaryBuf);
    phi1.delete();
    let temp = this.levelSet;
    this.levelSet = this.gpuManager.advectLiquidLevelSetOrder3(dt, this.vel0, this.levelSet, phi2, this.boundaryBuf, this.decay, this.lsAdvectionDamping);
    temp.delete();
    phi2.delete();
  }

  _rkReinitLevelSet(dt, levelSet0, levelSetN) {
    const levelSetNPlus1 = this.gpuManager.reinitLevelSet(dt, levelSet0, levelSetN, this.boundaryBuf, this.levelSetDamping);
    const levelSetNPlus2 = this.gpuManager.reinitLevelSet(dt, levelSet0, levelSetNPlus1, this.boundaryBuf, this.levelSetDamping);
    levelSetNPlus1.delete();
    const rkLevelSet = this.gpuManager.rungeKuttaLevelSet(levelSetN, levelSetNPlus2, this.boundaryBuf);
    levelSetNPlus2.delete();
    return rkLevelSet;
  }
  reinitLevelSetRK(dt, numIter=REINIT_PER_FRAME_LOOPS) {
    const levelSet0 = this.levelSet;
    let levelSetN = this._rkReinitLevelSet(dt, levelSet0, levelSet0);
    let temp = null;
    for (let i = 0; i < numIter-1; i++) {
      temp = levelSetN;
      levelSetN = this._rkReinitLevelSet(dt, levelSet0, levelSetN);
      temp.delete();
    }
    this.levelSet = levelSetN;
    levelSet0.delete();
  }
  reinitLevelSetFE(dt, numIter=REINIT_PER_FRAME_LOOPS) {
    const levelSet0 = this.levelSet;
    let levelSetN = this.gpuManager.reinitLevelSet(dt, levelSet0, levelSet0, this.boundaryBuf, this.levelSetDamping);
    let temp = null;
    for (let i = 0; i < numIter-1; i++) {
      temp = levelSetN;
      levelSetN = this.gpuManager.reinitLevelSet(dt, levelSet0, levelSetN, this.boundaryBuf, this.levelSetDamping);
      temp.delete();
    }
    this.levelSet = levelSetN;
    levelSet0.delete();
  }

  advectVelocity(dt) {
    let temp = this.vel;
    this.vel = this.gpuManager.advectLiquidVelocity(dt, this.vel0, this.boundaryBuf, this.velAdvectionDamping);
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
      dt, force, this.vel, this.levelSet, this.levelEpsilon, this.boundaryBuf
    );
    temp.delete();

    if (this.forceBlob) {
      const {center, impulseStrength, size} = this.forceBlob;
      temp = this.vel;
      this.vel = this.gpuManager.injectForceBlob(center, impulseStrength, size, this.vel, this.boundaryBuf);
      temp.delete();
      this.forceBlob = null;
    }
  }

  computeVelocityDivergence() {
    let temp = this.tempScalarBuf1;
    this.tempScalarBuf1 = this.gpuManager.computeLiquidVelDiv(this.vel, this.levelSet, this.levelEpsilon, this.boundaryBuf);
    temp.delete();
  }

  computePressure(numIter=PRESSURE_PER_FRAME_LOOPS) {
    // Set the pressure outside the liquid to zero
    this.pressure.clear();
    let temp = null;
    for (let i = 0; i < numIter; i++) {
      temp = this.pressure;
      this.pressure = this.gpuManager.jacobiLiquid(this.pressure, this.tempScalarBuf1, this.boundaryBuf, this.levelSet, this.levelEpsilon);
      temp.delete();
    }
  }

  projectVelocity() {
    let temp = this.vel0;
    this.vel0 = this.gpuManager.projectLiquidVelocity(
      this.pressure, this.vel, this.boundaryBuf, this.levelSet, this.levelEpsilon, this.pressureModulation
    );
    temp.delete();
  }

  calcPressureDiff(dt) {
    let temp = null;

    temp = this.pressureDiff;
    this.pressureDiff = this.gpuManager.pressureDiff(this.pressure, this.prevPressure);
    temp.delete();

    let avg = 0;
    let count = 0;
    const pDiffArr = this.pressureDiff.toArray();
    for (let x = 0; x < pDiffArr.length; x++) {
      for (let y = 0; y < pDiffArr[x].length; y++) {
        for (let z = 0; z < pDiffArr[x][y].length; z++) {
          if (this.boundaryBuf[x][y][z]) { continue; }
          avg += Math.abs(pDiffArr[x][y][z]);
          count++;
        }
      }
    }
    avg /= count;
    if (avg < 1e-6) {
      this.pressureSlowdownTime += dt;
      this.lsAdvectionDamping = Math.min(1, this.lsAdvectionDamping + dt*0.01);
      //console.log("SLOWING DOWN... " + this.pressureSlowdownTime);
      if (this.pressureSlowdownTime >= 3) {
        this.stopSimulation = true;
      }
    }
    else {
      this.pressureSlowdownTime = 0;
      this.lsAdvectionDamping = Math.max(0, this.lsAdvectionDamping - dt*1.0);
    }

    temp = this.prevPressure;
    this.prevPressure = this.pressure.clone();
    temp.delete();
  }

  step(dt) {
    if (this.stopSimulation) { return; }

    // Enforce CFL condition on dt
    const MAX_ABS_SPD = 10;
    dt = Math.min(dt, 0.3*Math.min(this.dx/MAX_ABS_SPD, Math.min(this.dy/MAX_ABS_SPD, this.dz/MAX_ABS_SPD)));

    this.advectLevelSetRK3(dt);
    this.reinitLevelSetRK(dt);
    this.advectVelocity(dt);
    this.applyVorticityConfinement(dt);
    this.applyExternalForces(dt);
    this.computeVelocityDivergence();
    this.computePressure();
    this.projectVelocity();
    this.calcPressureDiff(dt);
    this.numRuns++;
  }

}

export default LiquidGPU;