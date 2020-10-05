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
const MAX_PRESSURE_VELOCITY = 11; // m/s
const PRESSURE_MAX_HEIGHT = 5;    // m

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

    this.maxLiquidVol = Math.pow(this.unitSize, 3); // Volumes are in m^3

    this.gravity = GRAVITY;
    this.vorticityConfinement = 0.012;
    this.viscosity = 1;
    this.count = 0;

    //this.gpuManager.initFluidKernels(size-2);
    this.gpuManager.initSimpleWater2DKernels(size, unitSize, {
      SOLID_CELL_TYPE, EMPTY_CELL_TYPE, 
      MAX_GRAVITY_VEL:  MAX_GRAVITY_VELOCITY, 
      MAX_PRESSURE_VEL: MAX_PRESSURE_VELOCITY,
      PRESSURE_MAX_HEIGHT,
      LIQUID_DENSITY, LIQUID_EPSILON, ATMO_PRESSURE,
      CELL_VOL_IDX, CELL_TYPE_IDX, CELL_SETTLED_IDX,
      MAX_CELL_LIQUID_VOL: this.maxLiquidVol,
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

  get unitArea() { return (this.unitSize*this.unitSize); }
  get unitVolume() { return this.unitSize*this.unitArea; }

  clearDiffs() {
    for (let i = 0; i < this.diffs.length; i++) {
      for (let j = 0; j < this.diffs[i].length; j++) {
        this.diffs[i][j] = 0;
      }
    }
  }

  applyCFL(dt) {
    return Math.min(dt, 0.3*this.unitSize/(Math.max(MAX_GRAVITY_VELOCITY, MAX_PRESSURE_VELOCITY)));
  }

  calculateAbsCrossSectionFlow(vel) {
    // Flow = (Velocity) * (Cross-Section Area)
    return Math.abs(vel * this.unitArea);
  }
  calculateFlow(remainingLiquid, destinationLiquid) {
    const sum = remainingLiquid + destinationLiquid;
    return sum <= this.maxLiquidVol ? this.maxLiquidVol : 0.5*sum;
  }

  advectVelocity(dt) {
    let temp = this.velField;
    this.velField = this.gpuManager.simpleWaterAdvectVel(dt, this.velField, this.cells);
    temp.delete();

    /*
    const {clamp} = THREE.MathUtils;
    const minClamp = 0.5;
    const maxClamp = this.velField.length-1.5;

    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        for (let z = 0; z < this.velField[x][y].length; z++) {
          const u = this.velField[x][y][z];

          const cell = cells[x][y][z];
          if (cell.type === SOLID_CELL_TYPE || cell.settled) {
            u[0] = u[1] = u[2] = 0;
            continue;
          }

          const xx = clamp(x-dt*u[0], minClamp, maxClamp);
          const yy = clamp(y-dt*u[1], minClamp, maxClamp);
          const zz = clamp(z-dt*u[2], minClamp, this.velField[x][y].length-1.5);
          const i0 = Math.floor(xx), i1 = i0 + 1;
          const j0 = Math.floor(yy), j1 = j0 + 1;
          const k0 = Math.floor(zz), k1 = k0 + 1;
          const sx1 = xx-i0, sx0 = 1-sx1;
          const sy1 = yy-j0, sy0 = 1-sy1;
          const sz1 = zz-k0, sz0 = 1-sz1;
          const vel000 = this.velField[i0][j0][k0], vel010 = this.velField[i0][j1][k0];
          const vel100 = this.velField[i1][j0][k0], vel110 = this.velField[i1][j1][k0];
          const vel001 = this.velField[i0][j0][k1], vel011 = this.velField[i0][j1][k1];
          const vel101 = this.velField[i1][j0][k1], vel111 = this.velField[i1][j1][k1];
          for (let i = 0; i < 3; i++) {
            const v0 = sx0*(sy0*vel000[i] + sy1*vel010[i]) + sx1*(sy0*vel100[i] + sy1*vel110[i]);
            const v1 = sx0*(sy0*vel001[i] + sy1*vel011[i]) + sx1*(sy0*vel101[i] + sy1*vel111[i]);
            u[i] = sz0*v0 + sz1*v1;
          }
        }
      }
    }
    */
  }

  applyExternalForces(dt) {
    let temp = this.velField;
    this.velField = this.gpuManager.simpleWaterApplyExtForces(dt, this.gravity, this.velField, this.cells);
    temp.delete();

    /*
    const {clamp} = THREE.MathUtils;
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        const z = 1;
        const u = this.velField[x][y][z];
        const cell = cells[x][y][z];
        if (cell.type === SOLID_CELL_TYPE) { 
          u[0] = u[1] = u[2] = 0;
          continue; 
        }
        // Apply gravity...
        const bottomY = Math.max(0, y-1);
        const bottomCell = cells[x][bottomY][z];
        if (y !== bottomY && bottomCell.type === EMPTY_CELL_TYPE) {
          u[1] = clamp(u[1] - this.gravity*dt, -MAX_GRAVITY_VELOCITY, MAX_GRAVITY_VELOCITY);
        }
        else {
          u[1] = Math.min(0, u[1]);
        }

        // Apply hydrostatic pressure velocity...
        
        // Determine the hydrostatic pressure = density*gravity*(height of the fluid above this cell)
        // How much pressure is pressing down on this cell?
        let liquidVolAboveCell = 0;
        for (let i = y+1; i < Math.min(cells[x].length, y+1+LiquidSim.MAX_PRESSURE_CELL_COUNT); i++) {
          const aboveCell = cells[x][i][z];
          if (aboveCell.type === SOLID_CELL_TYPE) { break; }
          else if (aboveCell.type === EMPTY_CELL_TYPE) {
            if (aboveCell.liquidVol < LiquidSim.LIQUID_EPSILON) { break; }
            liquidVolAboveCell += aboveCell.liquidVol;
          }
        }
        const cellMass = cell.liquidVol*LIQUID_DENSITY;
        const liquidMassAboveCell = LIQUID_DENSITY*liquidVolAboveCell;
        const hsForce = (ATMO_PRESSURE + liquidMassAboveCell*GRAVITY)*this.unitArea;
        const dHSVel  = hsForce*dt/(cellMass+1e-6);

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const leftCell = cells[xm1][y][z];
        const rightCell = cells[xp1][y][z];
        let totalVel = 0;
        if (leftCell.type === EMPTY_CELL_TYPE && cell.liquidVol > leftCell.liquidVol && 
          (bottomCell.type === SOLID_CELL_TYPE || bottomCell.liquidVol >= cell.liquidVol)) {
          totalVel -= dHSVel;
        }
        else {
          u[0] = Math.max(0, u[0]);
        }
        if (rightCell.type === EMPTY_CELL_TYPE && cell.liquidVol > rightCell.liquidVol &&
          (bottomCell.type === SOLID_CELL_TYPE || bottomCell.liquidVol >= cell.liquidVol)) {
          totalVel += dHSVel;
        }
        else {
          u[0] = Math.min(0, u[0]);
        }
        u[0] = clamp(u[0] + totalVel, -MAX_PRESSURE_VELOCITY, MAX_PRESSURE_VELOCITY);
      }
    }
    */
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

    /*
    const size = this.velField.length;
    // Calculate the curl and curl lengths
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);
        
        for (let z = 0; z < this.velField[x][y].length; z++) {

          const cell = cells[x][y][z];
          if (cell.type === SOLID_CELL_TYPE) { 
            this.tempBuffScalar[x][y][z] = 0;
            continue; 
          }

          const zm1 = Math.max(0, z-1), zp1 = Math.min(this.velField[x][y].length-1, z+1);

          const L = this.velField[xm1][y][z], R = this.velField[xp1][y][z];
          const B = this.velField[x][ym1][z], T = this.velField[x][yp1][z];
          const D = this.velField[x][y][zm1], U = this.velField[x][y][zp1];

          const result = this.tempBuffVec3[x][y][z];
          result[0] = 0.5 * ((T[2] - B[2]) - (U[1] - D[1]));
          result[1] = 0.5 * ((U[0] - D[0]) - (R[2] - L[2]));
          result[2] = 0.5 * ((R[1] - L[1]) - (T[0] - B[0]));
          // Store the length of the result
          this.tempBuffScalar[x][y][z] = Math.sqrt(
            result[0]*result[0] + result[1]*result[1] + result[2]*result[2]
          );
        }
      }

      // Apply confinement
      const eta = new THREE.Vector3();
      const dtEpsilon = this.applyCFL(dt*this.vorticityConfinement);
      for (let x = 0; x < this.velField.length; x++) {
        for (let y = 0; y < this.velField[x].length; y++) {
          const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
          const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

          for (let z = 0; z < this.velField[x][y].length; z++) {
            const u = this.velField[x][y][z];

            const cell = cells[x][y][z];
            if (cell.type === SOLID_CELL_TYPE) { 
              u[0] = u[1] = u[2] = 0;
              continue;
            }

            const zm1 = Math.max(0, z-1), zp1 = Math.min(this.velField[x][y].length-1, z+1);

            const omega  = this.tempBuffVec3[x][y][z];
            const omegaL = this.tempBuffScalar[xm1][y][z];
            const omegaR = this.tempBuffScalar[xp1][y][z];
            const omegaB = this.tempBuffScalar[x][ym1][z];
            const omegaT = this.tempBuffScalar[x][yp1][z];
            const omegaD = this.tempBuffScalar[x][y][zm1];
            const omegaU = this.tempBuffScalar[x][y][zp1];

            eta.set(0.5 * (omegaR - omegaL), 0.5 * (omegaT - omegaB), 0.5 * (omegaU - omegaD));
            let len = eta.length() + 1e-6;
            eta.divideScalar(len);
            
            u[0] += dtEpsilon * (eta.x*omega[2] - eta.z*omega[1]);
            u[1] += dtEpsilon * (eta.z*omega[0] - eta.x*omega[2]);
            u[2] += dtEpsilon * (eta.x*omega[1] - eta.y*omega[0]);
          }
        }
      }
    }
    */
  }

  computeDivergence() {
    let temp = this.tempBuffScalar;
    this.tempBuffScalar = this.gpuManager.simpleWaterDiv(this.velField, this.cells);
    temp.delete();

    /*
    const noVel = [0,0,0];
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        
        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

        for (let z = 0; z < this.velField[x][y].length; z++) {
          const cell = cells[x][y][z];
          if (cell.type === SOLID_CELL_TYPE) {
            this.tempBuffScalar[x][y][z] = 0;
            continue; 
          }
          const zm1 = Math.max(0, z-1), zp1 = Math.min(this.velField[x][y].length-1, z+1);

          // NOTE: If the boundary has a velocity then change noVel to that velocity!
          // NOTE: All boundaries extend in the z dimension
          const fieldL = (cells[xm1][y][z].type === SOLID_CELL_TYPE) ? 
            noVel : this.velField[xm1][y][z];
          const fieldR = (cells[xp1][y][z].type === SOLID_CELL_TYPE) ? 
            noVel : this.velField[xp1][y][z];
          const fieldB = (cells[x][ym1][z].type === SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][ym1][z];
          const fieldT = (cells[x][yp1][z].type === SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][yp1][z];
          const fieldD = (cells[x][y][zm1].type === SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][y][zm1];
          const fieldU = (cells[x][y][zp1].type === SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][y][zp1];

          this.tempBuffScalar[x][y][z] = 0.5 * (
            (fieldR[0]-fieldL[0]) + (fieldT[1]-fieldB[1]) + (fieldU[2]-fieldD[2])
          );
        }
      }
    }
    */
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

    /*
    for (let x = 0; x < this.pressureField.length; x++) {
      for (let y = 0; y < this.pressureField[x].length; y++) {
        for (let z = 0; z < this.pressureField[x][y].length; z++) {
          this.pressureField[x][y][z] = 0;
        }
      }
    }
    const size = this.pressureField.length;
    for (let i = 0; i < numIter; i++) {
      for (let x = 0; x < this.pressureField.length; x++) {
        for (let y = 0; y < this.pressureField[x].length; y++) {
          
          const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
          const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

          for (let z = 0; z < this.pressureField[x][y].length; z++) {
            const cell = cells[x][y][z];
            if (cell.type === SOLID_CELL_TYPE) { continue; }
            
            const pC = this.pressureField[x][y][z];
            const bC = this.tempBuffScalar[x][y][z]; // Contains the 'divergence' calculated previously
            const zm1 = Math.max(0, z-1), zp1 = Math.min(this.pressureField[x][y].length-1, z+1);
            
            let pL = this.pressureField[xm1][y][z];
            let pR = this.pressureField[xp1][y][z];
            let pB = this.pressureField[x][ym1][z];
            let pT = this.pressureField[x][yp1][z];
            let pD = this.pressureField[x][y][zm1];
            let pU = this.pressureField[x][y][zp1];

            if (cells[xm1][y][z].type === SOLID_CELL_TYPE) { pL = pC; }
            if (cells[xp1][y][z].type === SOLID_CELL_TYPE) { pR = pC; }
            if (cells[x][ym1][z].type === SOLID_CELL_TYPE) { pB = pC; }
            if (cells[x][yp1][z].type === SOLID_CELL_TYPE) { pT = pC; }
            if (cells[x][y][zm1].type === SOLID_CELL_TYPE) { pD = pC; }
            if (cells[x][y][zp1].type === SOLID_CELL_TYPE) { pU = pC; }

            this.tempPressure[x][y][z] = (pL + pR + pB + pT + pU + pD - bC) / 6.0;
          }
        }
      }
      // Swap the buffers
      let temp = this.pressureField;
      this.pressureField = this.tempPressure;
      this.tempPressure = temp;
    }
    */
  }
  
  projectVelocityFromPressure() {
    let temp = this.velField;
    this.velField = this.gpuManager.simpleWaterProjVel(this.pressureField, this.velField, this.cells);
    temp.delete();
    /*
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

        for (let z = 0; z < this.velField[x][y].length; z++) {
          const u = this.velField[x][y][z];

          // Boundaries extend in z dimension
          const cell = cells[x][y][z];
          if (cell.type === SOLID_CELL_TYPE) { 
            u[0] = u[1] = u[2] = 0;
            continue; 
          }

          const zm1 = Math.max(0, z-1), zp1 = Math.min(this.pressureField[x][y].length-1, z+1);

          let pC = this.pressureField[x][y][z];  
          let pL = this.pressureField[xm1][y][z], pR = this.pressureField[xp1][y][z];
          let pB = this.pressureField[x][ym1][z], pT = this.pressureField[x][yp1][z];
          let pD = this.pressureField[x][y][zm1], pU = this.pressureField[x][y][zp1];

          // NOTE: This requires augmentation if the boundaries have velocity!
          const vMaskPos = [1,1,1];
          const vMaskNeg = [1,1,1];

          if (cells[xm1][y][z].type === SOLID_CELL_TYPE) { pL = pC; vMaskNeg[0] = 0; }
          if (cells[xp1][y][z].type === SOLID_CELL_TYPE) { pR = pC; vMaskPos[0] = 0; }
          if (cells[x][ym1][z].type === SOLID_CELL_TYPE) { pB = pC; vMaskNeg[1] = 0; }
          if (cells[x][yp1][z].type === SOLID_CELL_TYPE) { pT = pC; vMaskPos[1] = 0; }
          if (cells[x][y][zm1].type === SOLID_CELL_TYPE) { pD = pC; vMaskPos[2] = 0; }
          if (cells[x][y][zp1].type === SOLID_CELL_TYPE) { pU = pC; vMaskNeg[2] = 0; }

          u[0] -= 0.5 * (pR-pL);
          u[1] -= 0.5 * (pT-pB);
          u[2] -= 0.5 * (pU-pD);

          u[0] = Math.min(u[0]*vMaskPos[0], Math.max(u[0]*vMaskNeg[0], u[0]));
          u[1] = Math.min(u[1]*vMaskPos[1], Math.max(u[1]*vMaskNeg[1], u[1]));
          u[2] = Math.min(u[2]*vMaskPos[2], Math.max(u[2]*vMaskNeg[2], u[2]));
        }
      }
    }
    */
  }

  diffuseVelocity(dt, numIter=3) {
    const vol = Math.pow(this.gridSize-2,2)*3;
    const a = dt*this.viscosity*vol;
    let temp = null;
    for (let i = 0; i < numIter; i++) {
      temp = this.velField;
      this.velField = this.gpuManager.simpleWaterDiffuseVel(this.velField, this.cells, a);
      temp.delete();
    }
    /*
    const size = this.velField.length;
    const a = dt*this.viscosity*this.velField.length*this.velField[0].length*this.velField[0][0].length;
    const divisor = 1.0 + 6.0*a;
    for (let j = 0; j < numIter; j++) {
      for (let x = 0; x < this.velField.length; x++) {
        for (let y = 0; y < this.velField[x].length; y++) {

          const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
          const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

          for (let z = 0; z < this.velField[x][y].length; z++) {
            const u = this.velField[x][y][z];

            // Boundaries extend in z dimension
            const cell = cells[x][y][z];
            if (cell.type === SOLID_CELL_TYPE) { 
              u[0] = u[1] = u[2] = 0;
              continue; 
            }

            const zm1 = Math.max(0, z-1), zp1 = Math.min(this.velField[x][y].length-1, z+1);

            const uxNeg = (cells[xm1][y][z].type === SOLID_CELL_TYPE) ? u : this.velField[xm1][y][z];
            const uxPos = (cells[xp1][y][z].type === SOLID_CELL_TYPE) ? u : this.velField[xp1][y][z];
            const uyNeg = (cells[x][ym1][z].type === SOLID_CELL_TYPE) ? u : this.velField[x][ym1][z];
            const uyPos = (cells[x][yp1][z].type === SOLID_CELL_TYPE) ? u : this.velField[x][yp1][z];
            const uzNeg = (cells[x][y][zm1].type === SOLID_CELL_TYPE) ? u : this.velField[x][y][zm1];
            const uzPos = (cells[x][y][zp1].type === SOLID_CELL_TYPE) ? u : this.velField[x][y][zp1];

            for (let i = 0 ; i < 3; i++) {
              u[i] = (u[i] + a*(uxNeg[i] + uxPos[i] + uyNeg[i] + uyPos[i] + uzNeg[i] + uzPos[i])) / divisor;
            }
          }
        }
      }
    }
    */
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
    /*
    this.clearDiffs();
    let startLiquid = 0, remainingLiquid = 0;
    let flowToTop = 0, flowToBottom = 0, flowToLeft = 0, flowToRight = 0;

    for (let x = 0; x < this.cells.length; x++) {
      for (let y = 0; y < this.cells[x].length; y++) {

        const cell = this.cells[x][y][1];
        const liquidVol = cell[CELL_VOL_IDX];
        const type = cell[CELL_TYPE_IDX];
        const settled = cell[CELL_SETTLED_IDX];

        if (type === SOLID_CELL_TYPE || liquidVol < LiquidSim.LIQUID_EPSILON) {
          cell[CELL_VOL_IDX] = 0;
          continue;
        }
        if (settled || liquidVol === 0) { continue; }

        startLiquid = liquidVol;
        remainingLiquid = startLiquid;
        flowToTop = 0, flowToBottom = 0, flowToLeft = 0, flowToRight = 0;
        const velocity = this.velField[x][y][1];

        const topCell    = y > this.cells[x].length-2 ? null : this.cells[x][y+1][1];
        const bottomCell = y < 1 ? null : this.cells[x][y-1][1];
        const rightCell  = x > this.cells.length-2 ? null : this.cells[x+1][y][1];
        const leftCell   = x < 1 ? null : this.cells[x-1][y][1];

        if (velocity[1] > 0 && topCell && topCell[CELL_TYPE_IDX] === EMPTY_CELL_TYPE && 
            topCell[CELL_VOL_IDX] < liquidVol) {
          let flowFrac = liquidVol - this.calculateFlow(liquidVol, topCell[CELL_VOL_IDX]);
          flowToTop = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[1]));
        }
        if (velocity[1] < 0 && bottomCell && bottomCell[CELL_TYPE_IDX] === EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateFlow(liquidVol, bottomCell[CELL_VOL_IDX]) - bottomCell[CELL_VOL_IDX];
          flowToBottom = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[1]));
        }
        if (velocity[0] < 0 && leftCell && leftCell[CELL_TYPE_IDX] === EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateFlow(liquidVol, leftCell[CELL_VOL_IDX]);
          flowToLeft = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[0]));
        }
        if (velocity[0] > 0 && rightCell && rightCell[CELL_TYPE_IDX] === EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateFlow(liquidVol, rightCell[CELL_VOL_IDX]);
          flowToRight = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[0]));
        }
        
        let numUnmasked = 4;
        let leftMask = 1, rightMask = 1, topMask = 1, bottomMask = 1;
        // Can we flow down?
        if (bottomCell && (bottomCell[CELL_VOL_IDX] >= this.maxLiquidVol || 
            bottomCell[CELL_TYPE_IDX] === SOLID_CELL_TYPE)) {
          // No flow downward, redirect that force to the other flows
          numUnmasked--;
          const flowBottomDiv = flowToBottom / numUnmasked;
          flowToLeft  += flowBottomDiv;
          flowToRight += flowBottomDiv;
          flowToTop   += flowBottomDiv;
          flowToBottom = 0, bottomMask = 0;
        }
        // Can we flow left?
        if (leftCell && (leftCell[CELL_VOL_IDX] >= this.maxLiquidVol || 
            leftCell[CELL_TYPE_IDX] === SOLID_CELL_TYPE)) {
          // No flow leftward, redirect to other flows
          numUnmasked--;
          const flowLeftDiv = flowToLeft / numUnmasked;
          flowToRight  += flowLeftDiv;
          flowToTop    += flowLeftDiv;
          flowToBottom += flowLeftDiv;
          flowToLeft = 0, leftMask = 0;
        }
        // Can we flow right?
        if (rightCell && (rightCell[CELL_VOL_IDX] >= this.maxLiquidVol ||
            rightCell[CELL_TYPE_IDX] === SOLID_CELL_TYPE)) {
          // No flow rightward, redirect to other flows
          numUnmasked--;
          const flowRightDiv = flowToRight / numUnmasked;
          flowToTop    += flowRightDiv;
          flowToBottom += flowRightDiv;
          flowToLeft   += flowRightDiv;
          flowToRight = 0, rightMask = 0;
        }
        // Can we flow up?
        if (topCell && (topCell[CELL_VOL_IDX] >= this.maxLiquidVol ||
            topCell[CELL_TYPE_IDX] === SOLID_CELL_TYPE)) {
          // No flow upward, nothing is redirected
          numUnmasked--;
          flowToTop = 0, topMask = 0;
        }

        flowToTop    *= topMask;
        flowToBottom *= bottomMask;
        flowToRight  *= rightMask;
        flowToLeft   *= leftMask;

        const sumFlow = (flowToTop+flowToBottom+flowToLeft+flowToRight);
        if (numUnmasked > 0 && sumFlow >= LiquidSim.LIQUID_EPSILON) {
          flowToTop    = (flowToTop/sumFlow)*startLiquid*dt*this.calculateAbsCrossSectionFlow(velocity[1]);
          flowToBottom = (flowToBottom/sumFlow)*startLiquid*dt*this.calculateAbsCrossSectionFlow(velocity[1]);
          flowToRight  = (flowToRight/sumFlow)*startLiquid*dt*this.calculateAbsCrossSectionFlow(velocity[0]);
          flowToLeft   = (flowToLeft/sumFlow)*startLiquid*dt*this.calculateAbsCrossSectionFlow(velocity[0]);

          const total = (flowToTop+flowToBottom+flowToRight+flowToLeft);
          if (total > liquidVol) {
            const adjustMult = liquidVol/total;
            flowToTop    *= adjustMult;
            flowToBottom *= adjustMult;
            flowToRight  *= adjustMult;
            flowToLeft   *= adjustMult;
          }

          if (flowToTop !== 0) {
            remainingLiquid -= flowToTop;
            this.diffs[x][y] -= flowToTop;
            this.diffs[x][y+1] += flowToTop;
            topCell[CELL_SETTLED_IDX] = 0;
          }
          if (flowToBottom !== 0) {
            remainingLiquid -= flowToBottom;
						this.diffs[x][y] -= flowToBottom;
						this.diffs[x][y-1] += flowToBottom;
						bottomCell[CELL_SETTLED_IDX] = 0;
          }
          if (flowToLeft !== 0) {
            remainingLiquid -= flowToLeft;
						this.diffs[x][y] -= flowToLeft;
            this.diffs[x-1][y] += flowToLeft;
						leftCell[CELL_SETTLED_IDX] = 0;
          }
          if (flowToRight !== 0) {
						remainingLiquid -= flowToRight;
						this.diffs[x][y] -= flowToRight;
            this.diffs[x+1][y] += flowToRight;
						rightCell[CELL_SETTLED_IDX] = 0;
					} 
        }

        // Check if cell is settled
				if (startLiquid === remainingLiquid) {
					cell.settleCount++;
					if (cell.SettleCount >= 10) {
						cell.settled = true;
					}
        }
        else {
					cell.unsettleNeighbours();
				}
      }
    }

    // Update Cell values
    let totalVol = 0;
    for (let x = 0; x < cells.length; x++) {
      for (let y = 0; y < cells[x].length; y++) {
        const cell = cells[x][y][1];
        cell.addLiquid(this.diffs[x][y]);
        if (cell.liquidVol < LiquidSim.LIQUID_EPSILON) {
          cell.liquidVol = 0;
          const velocity = this.velField[x][y][1];
          velocity[0] = velocity[1] = velocity[2] = 0;
          cell.settled = false;
        }		
        totalVol += cell.liquidVol;		
      }
    }
    if (this.count % 1000 === 0) {
      console.log(totalVol);
    }
    this.count++;
    */
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