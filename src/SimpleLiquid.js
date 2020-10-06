import * as THREE from 'three';

class SimpleLiquid {
  constructor(gridSize, gpuManager) {
    this.liquidSim = new LiquidSim(gridSize+2, 1, gpuManager);
  }

  step(dt) {
    this.liquidSim.simulate(dt);
  }
}

const GRAVITY = 9.81;             // m/s^2
const LIQUID_DENSITY = 1000;      // Kg/m^3
const ATMO_PRESSURE  = 101325;    // N/m^2 (or Pascals)
const MAX_GRAVITY_VELOCITY  = 11; // m/s
const MAX_PRESSURE_VELOCITY = 4; // m/s
const PRESSURE_MAX_HEIGHT   = 10;  // m

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

    this.gpuManager = gpuManager;

    this.gravity = GRAVITY;
    this.vorticityConfinement = 0.012;
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
    this.flowField      = this.gpuManager.buildSimpleWaterBufferVec4();
    this.flowSumField   = this.gpuManager.buildSimpleWaterBufferScalar();

    this.cells = this.gpuManager.buildSimpleWaterCellBuffer();
  }

  get maxCellVolume() { return Math.pow(this.unitSize,3); }

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

  computePressure(numIter=12) {
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

  diffuseVelocity(dt, numIter=10) {
    const vol = Math.pow(this.gridSize-2,2);
    const a = dt*this.viscosity*vol;
    let temp = null;
    for (let i = 0; i < numIter; i++) {
      temp = this.velField;
      this.velField = this.gpuManager.simpleWaterDiffuseVel(this.velField, this.cells, a);
      temp.delete();
    }
  }
  
  simulate(dt) {
    // Enforce CFL condition on dt
    dt = this.applyCFL(dt);

    this.advectVelocity(dt);
    this.applyExternalForces(dt);
    this.applyVorticityConfinement(dt);
    this.computeDivergence();
    this.computePressure();
    this.diffuseVelocity(dt);
    this.projectVelocityFromPressure();
    
    let temp = this.flowField;
    this.flowField = this.gpuManager.simpleWaterCalcFlows(dt, this.velField, this.cells);
    temp.delete();
    
    temp = this.flowSumField;
    this.flowSumField = this.gpuManager.simpleWaterSumFlows(this.flowField, this.cells);
    temp.delete();

    temp = this.cells;
    this.cells = this.gpuManager.simpleWaterAdjustFlows(this.flowSumField, this.cells);
    temp.delete();
  }
}

export class LiquidCell {
  constructor() {
    this.liquidVol = 0;
    this._settled = false;
    this._type = EMPTY_CELL_TYPE;
    this.settleCount = 0;
    this.top = this.bottom = this.left = this.right = null;
  }

  get type() { return this._type; }
  set type(t) {
    this._type = t;
    if (t === SOLID_CELL_TYPE) { this.liquidVol = 0; }
    this.unsettleNeighbours();
  }

  get settled() { return this._settled; }
  set settled(s) {
    this._settled = s;
    if (!s) { this.settleCount = 0; }
  }

  addLiquid(amount) {
    this.liquidVol += amount;
    this.settled = false;
  }

  unsettleNeighbours() {
    if (this.top) { this.top.settled = false; }
    if (this.bottom) { this.bottom.settled = false; }
    if (this.left) { this.left.settled = false; }
    if (this.right) { this.right.settled = false; }
  }

}


export default SimpleLiquid;