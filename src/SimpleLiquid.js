import * as THREE from 'three';

class SimpleLiquid {
  constructor(gridSize, gpuManager) {
    const gsPlus2 = gridSize+2;

    const unitSize = 1;
    const volumePerUnit = Math.pow(unitSize,3);

    this.liquidSim = new LiquidSim(gsPlus2, unitSize, gpuManager);
    
    this.cells = new Array(gsPlus2).fill(null);
    for (let x = 0; x < gsPlus2; x++) {
      this.cells[x] = new Array(gsPlus2).fill(null);
      for (let y = 0; y < gsPlus2; y++) {
        this.cells[x][y] = new Array(3).fill(null);
        for (let z = 0; z < this.cells[x][y].length; z++) {
          this.cells[x][y][z] = new LiquidCell();
        }
      }
    }
    for (let x = 0; x < gsPlus2; x++) {
      for (let y = 0; y < gsPlus2; y++) {
        const cell = this.cells[x][y][1];
        cell.left   = x > 0 ? this.cells[x-1][y][1] : null;
        cell.right  = x < gsPlus2-1 ? this.cells[x+1][y][1] : null;
        cell.bottom = y > 0 ? this.cells[x][y-1][1] : null;
        cell.top    = y < gsPlus2-1 ? this.cells[x][y+1][1] : null;
        this.cells[x][y][0].type = LiquidCell.SOLID_CELL_TYPE;
        this.cells[x][y][2].type = LiquidCell.SOLID_CELL_TYPE;
      }
    }

    // Set boundary around the outside
    for (let i = 0; i < gsPlus2; i++) {
      this.cells[i][0][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[i][1][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[i][gsPlus2-1][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[i][gsPlus2-2][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[0][i][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[1][i][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[gsPlus2-1][i][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[gsPlus2-2][i][1].type = LiquidCell.SOLID_CELL_TYPE;
    }
    // Add some liquid
    for (let x = 2; x < gsPlus2-2; x++) {
      for (let y = gsPlus2-3; y >= gsPlus2-5; y--) {
        this.cells[x][y][1].addLiquid(volumePerUnit);
      }
      
    }
    for (let x = 15; x < gsPlus2-2; x++) {
      this.cells[x][24][1].type = LiquidCell.SOLID_CELL_TYPE;
    }
    for (let x = 2; x < 15; x++) {
      this.cells[x][15][1].type = LiquidCell.SOLID_CELL_TYPE;
    }
    for (let y = 3; y < 9; y++) {
      this.cells[5][y][1].type = LiquidCell.SOLID_CELL_TYPE;
    }
  }

  step(dt) {
    this.liquidSim.simulate(dt, this.cells);
  }

}

const GRAVITY = 9.81;             // m/s^2
const LIQUID_DENSITY = 1000;      // Kg/m^3
const ATMO_PRESSURE  = 101325;    // N/m^2 (or Pascals)
const MAX_GRAVITY_VELOCITY  = 11; // m/s
const MAX_PRESSURE_VELOCITY = 9;  // m/s
const PRESSURE_MAX_HEIGHT = 5;    // m

class LiquidSim {
  static get LIQUID_EPSILON() { return 1e-6; }

  // Flows are in m^2/s
  static get MAX_FLOW() { return 1.0; } 
  static get MIN_FLOW() { return LiquidSim.LIQUID_EPSILON; }

  static get MAX_PRESSURE_CELL_COUNT() { return 5; }

  constructor(size, unitSize, gpuManager) {

    this.unitSize = unitSize; // Units are in meters
    this.maxLiquidVol = Math.pow(this.unitSize,3); // Volumes are in m^3
    this.gpuManager = gpuManager;

    this.gpuManager.initFluidKernels(size-2);
    this.gpuManager.initSimpleWater2DKernels(size, unitSize, {
      SOLID_CELL_TYPE:  LiquidCell.SOLID_CELL_TYPE, 
      LIQUID_CELL_TYPE: LiquidCell.LIQUID_CELL_TYPE, 
      MAX_GRAVITY_VEL:  MAX_GRAVITY_VELOCITY, 
      MAX_PRESSURE_VEL: MAX_PRESSURE_VELOCITY,
      PRESSURE_MAX_HEIGHT: PRESSURE_MAX_HEIGHT,
      LIQUID_DENSITY: LIQUID_DENSITY,
      LIQUID_EPSILON: LiquidSim.LIQUID_EPSILON,
      ATMO_PRESSURE: ATMO_PRESSURE,
    });

    this.gravity = GRAVITY;
    //this.maxGravityVel = MAX_GRAVITY_VELOCITY;
    //this.maxPressureVel = MAX_PRESSURE_VELOCITY;

    this.tempBuffScalar = this.build3DBuffer(size, 3, 1)
    this.tempBuffVec3   = this.build3DBuffer(size, 3, 3);
    this.velField       = this.build3DBuffer(size, 3, 3);
    this.pressureField  = this.build3DBuffer(size, 3, 1);
    this.tempPressure   = this.build3DBuffer(size, 3, 1);

    this.vorticityConfinement = 0.012;
    this.viscosity = 1;
    this.count = 0;

    this.diffs = new Array(size).fill(null);
    for (let i = 0; i < size; i++) {
      this.diffs[i] = new Array(size).fill(0);
    }
  }

  build3DBuffer(xySize, zSize, vecDim) {
    const result = new Array(xySize).fill(null);
    for (let i = 0; i < xySize; i++) {
      result[i] = new Array(xySize).fill(null);
      for (let j = 0; j < xySize; j++) {
        result[i][j] = new Array(zSize).fill(null);
        for (let k = 0; k < zSize; k++) {
          result[i][j][k] = vecDim === 1 ? 0 : new Array(vecDim).fill(0);
        }
      }
    }
    return result;
  }

  get unitArea() { return (this.unitSize*this.unitSize); }

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

  advectVelocity(dt, cells) {
    const {clamp} = THREE.MathUtils;
    const minClamp = 0.5;
    const maxClamp = this.velField.length-1.5;

    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        for (let z = 0; z < this.velField[x][y].length; z++) {
          const u = this.velField[x][y][z];

          const cell = cells[x][y][z];
          if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.settled) {
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
  }

  applyExternalForces(dt, cells) {
    const {clamp} = THREE.MathUtils;
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        const z = 1;
        const u = this.velField[x][y][z];
        const cell = cells[x][y][z];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE) { 
          u[0] = u[1] = u[2] = 0;
          continue; 
        }
        // Apply gravity...
        const bottomY = Math.max(0, y-1);
        const bottomCell = cells[x][bottomY][z];
        if (y !== bottomY && bottomCell.type === LiquidCell.EMPTY_CELL_TYPE) {
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
          if (aboveCell.type === LiquidCell.SOLID_CELL_TYPE) { break; }
          else if (aboveCell.type === LiquidCell.EMPTY_CELL_TYPE) {
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
        if (leftCell.type === LiquidCell.EMPTY_CELL_TYPE && cell.liquidVol > leftCell.liquidVol && 
          (bottomCell.type === LiquidCell.SOLID_CELL_TYPE || bottomCell.liquidVol >= cell.liquidVol)) {
          totalVel -= dHSVel;
        }
        else {
          u[0] = Math.max(0, u[0]);
        }
        if (rightCell.type === LiquidCell.EMPTY_CELL_TYPE && cell.liquidVol > rightCell.liquidVol &&
          (bottomCell.type === LiquidCell.SOLID_CELL_TYPE || bottomCell.liquidVol >= cell.liquidVol)) {
          totalVel += dHSVel;
        }
        else {
          u[0] = Math.min(0, u[0]);
        }
        u[0] = clamp(u[0] + totalVel, -MAX_PRESSURE_VELOCITY, MAX_PRESSURE_VELOCITY);
      }
    }
  }

  applyVorticityConfinement(dt, cells) {
    const size = this.velField.length;
    // Calculate the curl and curl lengths
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);
        
        for (let z = 0; z < this.velField[x][y].length; z++) {

          const cell = cells[x][y][z];
          if (cell.type === LiquidCell.SOLID_CELL_TYPE) { 
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
            if (cell.type === LiquidCell.SOLID_CELL_TYPE) { 
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
  }

  computeDivergence(cells) {
    const noVel = [0,0,0];
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        
        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

        for (let z = 0; z < this.velField[x][y].length; z++) {
          const cell = cells[x][y][z];
          if (cell.type === LiquidCell.SOLID_CELL_TYPE) {
            this.tempBuffScalar[x][y][z] = 0;
            continue; 
          }
          const zm1 = Math.max(0, z-1), zp1 = Math.min(this.velField[x][y].length-1, z+1);

          // NOTE: If the boundary has a velocity then change noVel to that velocity!
          // NOTE: All boundaries extend in the z dimension
          const fieldL = (cells[xm1][y][z].type === LiquidCell.SOLID_CELL_TYPE) ? 
            noVel : this.velField[xm1][y][z];
          const fieldR = (cells[xp1][y][z].type === LiquidCell.SOLID_CELL_TYPE) ? 
            noVel : this.velField[xp1][y][z];
          const fieldB = (cells[x][ym1][z].type === LiquidCell.SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][ym1][z];
          const fieldT = (cells[x][yp1][z].type === LiquidCell.SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][yp1][z];
          const fieldD = (cells[x][y][zm1].type === LiquidCell.SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][y][zm1];
          const fieldU = (cells[x][y][zp1].type === LiquidCell.SOLID_CELL_TYPE) ? 
            noVel : this.velField[x][y][zp1];

          this.tempBuffScalar[x][y][z] = 0.5 * (
            (fieldR[0]-fieldL[0]) + (fieldT[1]-fieldB[1]) + (fieldU[2]-fieldD[2])
          );
        }
      }
    }
  }

  computePressure(cells, numIter=12) {
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
            if (cell.type === LiquidCell.SOLID_CELL_TYPE) { continue; }
            
            const pC = this.pressureField[x][y][z];
            const bC = this.tempBuffScalar[x][y][z]; // Contains the 'divergence' calculated previously
            const zm1 = Math.max(0, z-1), zp1 = Math.min(this.pressureField[x][y].length-1, z+1);
            
            let pL = this.pressureField[xm1][y][z];
            let pR = this.pressureField[xp1][y][z];
            let pB = this.pressureField[x][ym1][z];
            let pT = this.pressureField[x][yp1][z];
            let pD = this.pressureField[x][y][zm1];
            let pU = this.pressureField[x][y][zp1];

            if (cells[xm1][y][z].type === LiquidCell.SOLID_CELL_TYPE) { pL = pC; }
            if (cells[xp1][y][z].type === LiquidCell.SOLID_CELL_TYPE) { pR = pC; }
            if (cells[x][ym1][z].type === LiquidCell.SOLID_CELL_TYPE) { pB = pC; }
            if (cells[x][yp1][z].type === LiquidCell.SOLID_CELL_TYPE) { pT = pC; }
            if (cells[x][y][zm1].type === LiquidCell.SOLID_CELL_TYPE) { pD = pC; }
            if (cells[x][y][zp1].type === LiquidCell.SOLID_CELL_TYPE) { pU = pC; }

            this.tempPressure[x][y][z] = (pL + pR + pB + pT + pU + pD - bC) / 6.0;
          }
        }
      }
      // Swap the buffers
      let temp = this.pressureField;
      this.pressureField = this.tempPressure;
      this.tempPressure = temp;
    }
  }
  
  projectVelocityFromPressure(cells) {
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

        for (let z = 0; z < this.velField[x][y].length; z++) {
          const u = this.velField[x][y][z];

          // Boundaries extend in z dimension
          const cell = cells[x][y][z];
          if (cell.type === LiquidCell.SOLID_CELL_TYPE) { 
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

          if (cells[xm1][y][z].type === LiquidCell.SOLID_CELL_TYPE) { pL = pC; vMaskNeg[0] = 0; }
          if (cells[xp1][y][z].type === LiquidCell.SOLID_CELL_TYPE) { pR = pC; vMaskPos[0] = 0; }
          if (cells[x][ym1][z].type === LiquidCell.SOLID_CELL_TYPE) { pB = pC; vMaskNeg[1] = 0; }
          if (cells[x][yp1][z].type === LiquidCell.SOLID_CELL_TYPE) { pT = pC; vMaskPos[1] = 0; }
          if (cells[x][y][zm1].type === LiquidCell.SOLID_CELL_TYPE) { pD = pC; vMaskPos[2] = 0; }
          if (cells[x][y][zp1].type === LiquidCell.SOLID_CELL_TYPE) { pU = pC; vMaskNeg[2] = 0; }

          u[0] -= 0.5 * (pR-pL);
          u[1] -= 0.5 * (pT-pB);
          u[2] -= 0.5 * (pU-pD);

          u[0] = Math.min(u[0]*vMaskPos[0], Math.max(u[0]*vMaskNeg[0], u[0]));
          u[1] = Math.min(u[1]*vMaskPos[1], Math.max(u[1]*vMaskNeg[1], u[1]));
          u[2] = Math.min(u[2]*vMaskPos[2], Math.max(u[2]*vMaskNeg[2], u[2]));
        }
      }
    }
  }

  diffuseVelocity(dt, cells, numIter=3) {
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
            if (cell.type === LiquidCell.SOLID_CELL_TYPE) { 
              u[0] = u[1] = u[2] = 0;
              continue; 
            }

            const zm1 = Math.max(0, z-1), zp1 = Math.min(this.velField[x][y].length-1, z+1);

            const uxNeg = (cells[xm1][y][z].type === LiquidCell.SOLID_CELL_TYPE) ? u : this.velField[xm1][y][z];
            const uxPos = (cells[xp1][y][z].type === LiquidCell.SOLID_CELL_TYPE) ? u : this.velField[xp1][y][z];
            const uyNeg = (cells[x][ym1][z].type === LiquidCell.SOLID_CELL_TYPE) ? u : this.velField[x][ym1][z];
            const uyPos = (cells[x][yp1][z].type === LiquidCell.SOLID_CELL_TYPE) ? u : this.velField[x][yp1][z];
            const uzNeg = (cells[x][y][zm1].type === LiquidCell.SOLID_CELL_TYPE) ? u : this.velField[x][y][zm1];
            const uzPos = (cells[x][y][zp1].type === LiquidCell.SOLID_CELL_TYPE) ? u : this.velField[x][y][zp1];

            for (let i = 0 ; i < 3; i++) {
              u[i] = (u[i] + a*(uxNeg[i] + uxPos[i] + uyNeg[i] + uyPos[i] + uzNeg[i] + uzPos[i])) / divisor;
            }
          }
        }
      }
    }
  }

  simulate(dt, cells) {
    // Enforce CFL condition on dt
    dt = this.applyCFL(dt);

    const {clamp} = THREE.MathUtils;
    let startLiquid = 0, remainingLiquid = 0;
    let flowToTop = 0, flowToBottom = 0, flowToLeft = 0, flowToRight = 0;
    this.clearDiffs();

    this.advectVelocity(dt, cells);
    this.applyExternalForces(dt, cells);
    this.applyVorticityConfinement(dt, cells);
    this.computeDivergence(cells);
    this.computePressure(cells);
    this.diffuseVelocity(dt, cells);
    this.projectVelocityFromPressure(cells);

    for (let x = 0; x < cells.length; x++) {
      for (let y = 0; y < cells[x].length; y++) {
        const cell = cells[x][y][1];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.liquidVol < LiquidSim.LIQUID_EPSILON) {
          cell.liquidVol = 0;
          continue;
        }
        if (cell.settled || cell.liquidVol === 0) { continue; }

        const {liquidVol} = cell;
        startLiquid = liquidVol;
        remainingLiquid = startLiquid;
        flowToTop = 0, flowToBottom = 0, flowToLeft = 0, flowToRight = 0;
        const velocity = this.velField[x][y][1];
        
        if (velocity[1] > 0 && cell.top && cell.top.type === LiquidCell.EMPTY_CELL_TYPE && 
            cell.top.liquidVol < liquidVol) {
          let flowFrac = liquidVol - this.calculateFlow(liquidVol, cell.top.liquidVol);
          flowToTop = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[1]));
        }
        if (velocity[1] < 0 && cell.bottom && cell.bottom.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateFlow(liquidVol, cell.bottom.liquidVol) - cell.bottom.liquidVol;
          flowToBottom = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[1]));
        }
        if (velocity[0] < 0 && cell.left && cell.left.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateFlow(liquidVol, cell.left.liquidVol);
          flowToLeft = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[0]));
        }
        if (velocity[0] > 0 && cell.right && cell.right.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateFlow(liquidVol, cell.right.liquidVol);
          flowToRight = Math.max(0, flowFrac*this.calculateAbsCrossSectionFlow(velocity[0]));
        }
        
        let numUnmasked = 4;
        let leftMask = 1, rightMask = 1, topMask = 1, bottomMask = 1;
        // Can we flow down?
        if (cell.bottom && (cell.bottom.liquidVol >= this.maxLiquidVol || 
            cell.bottom.type === LiquidCell.SOLID_CELL_TYPE)) {
          // No flow downward, redirect that force to the other flows
          numUnmasked--;
          const flowBottomDiv = flowToBottom / numUnmasked;
          flowToLeft  += flowBottomDiv;
          flowToRight += flowBottomDiv;
          flowToTop   += flowBottomDiv;
          flowToBottom = 0, bottomMask = 0;
          
        }
        // Can we flow left?
        if (cell.left && (cell.left.liquidVol >= this.maxLiquidVol ||
            cell.left.type === LiquidCell.SOLID_CELL_TYPE)) {
          // No flow leftward, redirect to other flows
          numUnmasked--;
          const flowLeftDiv = flowToLeft / numUnmasked;
          flowToRight  += flowLeftDiv;
          flowToTop    += flowLeftDiv;
          flowToBottom += flowLeftDiv;
          flowToLeft = 0, leftMask = 0;
        }
        // Can we flow right?
        if (cell.right && (cell.right.liquidVol >= this.maxLiquidVol ||
          cell.right.type === LiquidCell.SOLID_CELL_TYPE)) {
          // No flow rightward, redirect to other flows
          numUnmasked--;
          const flowRightDiv = flowToRight / numUnmasked;
          flowToTop    += flowRightDiv;
          flowToBottom += flowRightDiv;
          flowToLeft   += flowRightDiv;
          flowToRight = 0, rightMask = 0;
        }
        // Can we flow up?
        if (cell.top && (cell.top.liquidVol >= this.maxLiquidVol ||
          cell.top.type === LiquidCell.SOLID_CELL_TYPE)) {
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
            cell.top.settled = false;
          }
          if (flowToBottom !== 0) {
            remainingLiquid -= flowToBottom;
						this.diffs[x][y] -= flowToBottom;
						this.diffs[x][y-1] += flowToBottom;
						cell.bottom.settled = false;
          }
          if (flowToLeft !== 0) {
            remainingLiquid -= flowToLeft;
						this.diffs[x][y] -= flowToLeft;
            this.diffs[x-1][y] += flowToLeft;
						cell.left.settled = false;
          }
          if (flowToRight !== 0) {
						remainingLiquid -= flowToRight;
						this.diffs[x][y] -= flowToRight;
            this.diffs[x+1][y] += flowToRight;
						cell.right.settled = false;
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
  }
}

export class LiquidCell {
  static get SOLID_CELL_TYPE() { return 1; }
  static get EMPTY_CELL_TYPE() { return 0; }
  constructor() {
    this.liquidVol = 0;
    this._settled = false;
    this._type = LiquidCell.EMPTY_CELL_TYPE;
    this.settleCount = 0;
    this.top = this.bottom = this.left = this.right = null;
  }

  get type() { return this._type; }
  set type(t) {
    this._type = t;
    if (t === LiquidCell.SOLID_CELL_TYPE) { this.liquidVol = 0; }
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