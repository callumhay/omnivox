import * as THREE from 'three';

class SimpleLiquid {
  constructor(gridSize, gpuManager) {
    this.liquidSim = new LiquidSim(gridSize+2, 1, gpuManager);
  }

  injectForceBlob(center, impulseStrength, size) {
    this.liquidSim.forceBlobs.push({center, impulseStrength, size});
  }

  step(dt) {
    this.liquidSim.simulate(dt);
  }
}

const GRAVITY = 9.81;             // m/s^2
const LIQUID_DENSITY = 1000;      // Kg/m^3
const ATMO_PRESSURE  = 101325;    // N/m^2 (or Pascals)
const MAX_GRAVITY_VELOCITY  = 11; // m/s
const MAX_PRESSURE_VELOCITY = 11; // m/s
const PRESSURE_MAX_HEIGHT   = 10;  // m

const PRESSURE_ITERS = 12;
const DIFFUSE_ITERS  = 10;

export const SOLID_CELL_TYPE = 1;
export const EMPTY_CELL_TYPE = 0;

const LIQUID_EPSILON = 1e-6;

export const CELL_VOL_IDX     = 0;
export const CELL_TYPE_IDX    = 1;
export const CELL_SETTLED_IDX = 2;

class LiquidSim {
  static get MAX_FLOW() { return 1.0; } // Flows are in m^2/s

  constructor(size, unitSize, gpuManager) {

    // Units are in meters
    this.gridSize = size;
    this.unitSize = unitSize; 
    this.maxCellVolume = Math.pow(unitSize,3);
    this.forceBlobs = [];

    this.gpuManager = gpuManager;

    this.gravity = GRAVITY;
    this.vorticityConfinement = 0;
    this.viscosity = 0;
    this.count = 0;

    this.gpuManager.initSimpleWater2DKernels(size, unitSize, {
      SOLID_CELL_TYPE, EMPTY_CELL_TYPE, 
      MAX_GRAVITY_VEL:  MAX_GRAVITY_VELOCITY, 
      MAX_PRESSURE_VEL: MAX_PRESSURE_VELOCITY,
      PRESSURE_MAX_HEIGHT,
      LIQUID_DENSITY, LIQUID_EPSILON, ATMO_PRESSURE,
      CELL_VOL_IDX, CELL_TYPE_IDX, CELL_SETTLED_IDX,
    });

    this.tempBuffScalar = this.gpuManager.buildSimpleWaterBufferScalar();
    this.pressureField  = this.gpuManager.buildSimpleWaterBufferScalar();
    this.tempPressure   = this.gpuManager.buildSimpleWaterBufferScalar();
    this.tempBuffVec3   = this.gpuManager.buildSimpleWaterBufferVec3();
    this.velField       = this.gpuManager.buildSimpleWaterBufferVec3();
    this.flowFieldLRB   = this.gpuManager.buildSimpleWaterBufferVec3();
    this.flowFieldDUT   = this.gpuManager.buildSimpleWaterBufferVec3();
    this.flowSumField   = this.gpuManager.buildSimpleWaterBufferScalar();

    this.cells = this.gpuManager.buildSimpleWaterCellBuffer();
  }

  applyCFL(dt) {
    return Math.min(dt, 0.3*this.unitSize/(Math.max(MAX_GRAVITY_VELOCITY, MAX_PRESSURE_VELOCITY)));
  }

  advectVelocity(dt) {
    let temp = this.velField;
    this.velField = this.gpuManager.simpleWaterAdvectVel(dt, this.velField, this.cells);
    temp.delete();
  }

  applyExternalForces(dt) {
    let temp = this.velField;
    this.velField = this.gpuManager.simpleWaterApplyExtForces(dt, this.gravity, this.velField, this.cells);
    temp.delete();

    for (const forceBlob of this.forceBlobs) {
      const {center, impulseStrength, size} = forceBlob;
      console.log(forceBlob);
      temp = this.velField;
      this.velField = this.gpuManager.simpleWaterInjectForceBlob(
        center, impulseStrength, size, this.velField, this.cells
      );
      temp.delete();
    }
    this.forceBlobs = [];
  }

  applyVorticityConfinement(dt) {
    let temp = this.tempBuffVec3;
    this.tempBuffVec3 = this.gpuManager.simpleWaterCurl(this.velField, this.cells);
    temp.delete();

    temp = this.tempBuffScalar;
    this.tempBuffScalar = this.gpuManager.simpleWaterCurlLen(this.tempBuffVec3);
    temp.delete();

    const dtVC = this.applyCFL(dt*this.vorticityConfinement);
    temp = this.velField;
    this.velField = this.gpuManager.simpleWaterApplyVC(
      dtVC, this.velField, this.cells, this.tempBuffVec3, this.tempBuffScalar
    );
    temp.delete();
  }

  computeDivergence() {
    let temp = this.tempBuffScalar;
    this.tempBuffScalar = this.gpuManager.simpleWaterDiv(this.velField, this.cells);
    temp.delete();
  }

  computePressure(numIter=PRESSURE_ITERS) {
    this.pressureField.clear();
    let temp = null;
    for (let i = 0; i < numIter; i++) {
      temp = this.pressureField;
      this.pressureField = this.gpuManager.simpleWaterComputePressure(
        this.pressureField, this.cells, this.tempBuffScalar
      );
      temp.delete();
    }
  }
  
  projectVelocityFromPressure() {
    let temp = this.velField;
    this.velField = this.gpuManager.simpleWaterProjVel(this.pressureField, this.velField, this.cells);
    temp.delete();
  }

  diffuseVelocity(dt, numIter=DIFFUSE_ITERS) {
    let temp = null;

    const a = dt*this.viscosity*Math.pow(this.gridSize-2,3);
    for (let i = 0; i < numIter; i++) {
      temp = this.tempBuffVec3;
      this.tempBuffVec3 = this.gpuManager.simpleWaterDiffuseVel(this.velField, this.tempBuffVec3, this.cells, a);
      temp.delete();
    }
    this.velField.delete();
    this.velField = this.tempBuffVec3;
  }
  
  simulate(dt) {
    // Enforce CFL condition on dt
    dt = this.applyCFL(dt);

    this.advectVelocity(dt);
    this.applyExternalForces(dt);
    this.applyVorticityConfinement(dt);
    //this.diffuseVelocity(dt);
    this.computeDivergence();
    this.computePressure();
    this.projectVelocityFromPressure();
    
    let temp = this.flowFieldLRB;
    this.flowFieldLRB = this.gpuManager.simpleWaterCalcFlowsLRB(dt, this.velField, this.cells);
    temp.delete();
    temp = this.flowFieldDUT;
    this.flowFieldDUT = this.gpuManager.simpleWaterCalcFlowsDUT(dt, this.velField, this.cells);
    temp.delete();
    
    temp = this.flowSumField;
    this.flowSumField = this.gpuManager.simpleWaterSumFlows(this.flowFieldLRB, this.flowFieldDUT, this.cells);
    temp.delete();

    temp = this.cells;
    this.cells = this.gpuManager.simpleWaterAdjustFlows(this.flowSumField, this.cells);
    temp.delete();
  }
}

export default SimpleLiquid;