import * as THREE from 'three';

class SimpleLiquid {
  constructor(gridSize) {
    const gsPlus2 = gridSize+2;

    const unitSize = 1;
    const volumePerUnit = Math.pow(unitSize,3);
    this.liquidSim = new LiquidSim(gsPlus2, unitSize);
    
    this.cells = new Array(gsPlus2).fill(null);
    for (let x = 0; x < gsPlus2; x++) {
      this.cells[x] = new Array(gsPlus2).fill(null);
      for (let y = 0; y < gsPlus2; y++) {
        this.cells[x][y] = new LiquidCell();
      }
    }
    for (let x = 0; x < gsPlus2; x++) {
      for (let y = 0; y < gsPlus2; y++) {
        const cell = this.cells[x][y];
        cell.left   = x > 0 ? this.cells[x-1][y] : null;
        cell.right  = x < gsPlus2-1 ? this.cells[x+1][y] : null;
        cell.bottom = y > 0 ? this.cells[x][y-1] : null;
        cell.top    = y < gsPlus2-1 ? this.cells[x][y+1] : null;
      }
    }

    // Set boundary around the outside
    for (let i = 0; i < gsPlus2; i++) {
      this.cells[i][0].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[i][1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[i][gsPlus2-1].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[i][gsPlus2-2].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[0][i].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[1][i].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[gsPlus2-1][i].type = LiquidCell.SOLID_CELL_TYPE;
      this.cells[gsPlus2-2][i].type = LiquidCell.SOLID_CELL_TYPE;
    }
    // Add some liquid
    for (let x = 2; x < gsPlus2-2; x++) {
      for (let y = gsPlus2-3; y >= gsPlus2-5; y--) {
        this.cells[x][y].addLiquid(volumePerUnit);
      }
      
    }
    for (let x = 15; x < gsPlus2-2; x++) {
      this.cells[x][24].type = LiquidCell.SOLID_CELL_TYPE;
    }
    for (let x = 2; x < 15; x++) {
      this.cells[x][15].type = LiquidCell.SOLID_CELL_TYPE;
    }
    for (let y = 3; y < 9; y++) {
      this.cells[5][y].type = LiquidCell.SOLID_CELL_TYPE;
    }
  }

  step(dt) {
    this.liquidSim.simulate(dt, this.cells);
  }

}

const GRAVITY = 9.81;  // m/s^2
const LIQUID_DENSITY = 1;
const ATMO_PRESSURE  = 10;

class LiquidSim {
  static get LIQUID_EPSILON() { return 1e-6; }

  // Flows are in m^2/s
  static get MAX_FLOW() { return 4.0; } 
  static get MIN_FLOW() { return LiquidSim.LIQUID_EPSILON; }

  static get MAX_PRESSURE_CELL_COUNT() { return 5; }

  constructor(size, unitSize) {
    this.unitSize = unitSize; // Units are in meters
    this.maxLiquidVol = Math.pow(this.unitSize,3); // Volumes are in m^3
    this.flowSpeed = 5.0;
    this.maxCompression = 0.15;

    this.tempBuffScalar = this.buildBuffer(size,1)
    this.tempBuffVec3   = this.buildBuffer(size,3);
    this.velField       = this.buildBuffer(size,3);

    this.pressureField  = this.buildBuffer(size,1);
    this.tempPressure   = this.buildBuffer(size,1);

    this.vorticityConfinement = 0.012;

    this.diffs = new Array(size).fill(null);
    for (let i = 0; i < size; i++) {
      this.diffs[i] = new Array(size).fill(0);
    }
  }

  buildBuffer(size, vecDim) {
    const result = new Array(size).fill(null);
    for (let i = 0; i < size; i++) {
      result[i] = new Array(size).fill(null);
      for (let j = 0; j < size; j++) {
        result[i][j] = vecDim === 1 ? 0 : new Array(vecDim).fill(0);
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

  calculateAbsCrossSectionFlow(vel) {
    // Flow = (Velocity) * (Cross-Section Area)
    return Math.abs(vel * this.unitArea);
  }

  calculateHorizontalFlow(remainingLiquid, destinationCell) {
    return 0.5 * ((remainingLiquid + this.maxCompression) - destinationCell.liquidVol);
  }

  calculateVerticalFlow(remainingLiquid, destinationCell) {
    const sum = remainingLiquid + destinationCell.liquidVol;
    let value = 0;
		if (sum <= this.maxLiquidVol) {
			value = this.maxLiquidVol;
    }
    else if (sum < 2 * this.maxLiquidVol + this.maxCompression) {
      value = (this.maxLiquidVol * this.maxLiquidVol + sum * this.maxCompression) / 
        (this.maxLiquidVol + this.maxCompression);
    }
    else {
			value = 0.5 * (sum + this.maxCompression);
		}
		return value;

    //return  (sum < 2*this.maxLiquidVol) ? this.maxLiquidVol :  0.5 * sum;
  }

  advectVelocity(dt, cells) {
    const {clamp} = THREE.MathUtils;
    const minClamp = 0.5;
    const maxClamp = this.velField.length-1.5;

    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        const u = this.velField[x][y];
        const cell = cells[x][y];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.settled) { continue; }
        const xx = clamp(x-dt*u[0], minClamp, maxClamp);
        const yy = clamp(y-dt*u[1], minClamp, maxClamp);
        //const zz = clampValue(z-dt*u.z, minClamp, maxClamp);
        const i0 = Math.floor(xx), i1 = i0 + 1;
        const j0 = Math.floor(yy), j1 = j0 + 1;
        //const k0 = Math.floor(zz), k1 = k0 + 1;
        const sx1 = xx-i0, sx0 = 1-sx1;
        const sy1 = yy-j0, sy0 = 1-sy1;
        //const sz1 = zz-k0, sz0 = 1-sz1;
        //const vel000 = vel0[i0][j0][k0], vel010 = vel0[i0][j1][k0], vel100 = vel0[i1][j0][k0];
        //const vel110 = vel0[i1][j1][k0], vel001 = vel0[i0][j0][k1], vel011 = vel0[i0][j1][k1];
        //const vel101 = vel0[i1][j0][k1], vel111 = vel0[i1][j1][k1];
        const vel00 = this.velField[i0][j0], vel01 = this.velField[i0][j1];
        const vel10 = this.velField[i1][j0], vel11 = this.velField[i1][j1];
        for (let i = 0; i < 2; i++) {
          u[i] += sx0*(sy0*vel00[i] + sy1*vel01[i]) + sx1*(sy0*vel10[i] + sy1*vel11[i]);
        }
      }
    }
  }

  applyExternalForces(dt, cells) {
    const {clamp} = THREE.MathUtils;
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        const u = this.velField[x][y];
        const cell = cells[x][y];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.settled) { continue; }
        // Apply gravity...
        u[1] = Math.max(u[1] - GRAVITY*dt, -10);

        // Apply hydrostatic pressure velocity...
        
        // Determine the hydrostatic pressure = density*gravity*(height of the fluid above this cell)
        // How much pressure is pressing down on this cell?
        let liquidVolAboveCell = 0;
        for (let i = y+1; i < Math.min(cells[x].length, y+1+LiquidSim.MAX_PRESSURE_CELL_COUNT); i++) {
          const aboveCell = cells[x][i];
          if (aboveCell.type === LiquidCell.SOLID_CELL_TYPE) { break; }
          else if (aboveCell.type === LiquidCell.EMPTY_CELL_TYPE) {
            if (aboveCell.liquidVol < LiquidSim.LIQUID_EPSILON) { break; }
            liquidVolAboveCell += aboveCell.liquidVol;
          }
        }
        const liquidMassAboveCell = LIQUID_DENSITY*liquidVolAboveCell;
        const hsForce = (10 + liquidMassAboveCell*GRAVITY)*this.unitArea;
        const dHSVel  = hsForce*dt/(liquidMassAboveCell+1e-6);

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const leftCell = cells[xm1][y];
        const rightCell = cells[xp1][y];
        let totalVel = 0;
        if (leftCell.type === LiquidCell.EMPTY_CELL_TYPE && cell.liquidVol > leftCell.liquidVol) {
          totalVel -= dHSVel;
          leftCell.settled = false;
        }
        else {
          u[0] = Math.max(0, u[0]);
        }
        if (rightCell.type === LiquidCell.EMPTY_CELL_TYPE && cell.liquidVol > rightCell.liquidVol) {
          totalVel += dHSVel;
          rightCell.settled = false;
        }
        else {
          u[0] = Math.min(0, u[0]);
        }
        u[0] = clamp(u[0] + totalVel, -20, 20);
      }
    }
  }

  applyVorticityConfinement(dt, cells) {
    const size = this.velField.length;
    // Calculate the curl and curl lengths
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        const result = this.tempBuffVec3[x][y];
        result[0] = result[1] = 0;
        this.tempBuffScalar[x][y] = 0

        const cell = cells[x][y];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.settled) { continue; }

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

        const L = [...this.velField[xm1][y],0]; const R = [...this.velField[xp1][y],0]
        const B = [...this.velField[x][ym1],0]; const T = [...this.velField[x][yp1],0];
        const D = [0,0,0], U = [0,0,0];
        result[0] = 0.5 * ((T[2] - B[2]) - (U[1] - D[1]));
        result[1] = 0.5 * ((U[0] - D[0]) - (R[2] - L[2]));
        result[2] = 0.5 * ((R[1] - L[1]) - (T[0] - B[0]));
        // Store the length of the result
        this.tempBuffScalar[x][y] = Math.sqrt(result[0]*result[0] + result[1]*result[1] + result[2]*result[2]);
      }

      // Apply confinement
      const eta = new THREE.Vector3();
      const dtEpsilon = dt*this.vorticityConfinement;
      for (let x = 0; x < this.velField.length; x++) {
        for (let y = 0; y < this.velField[x].length; y++) {
          const cell = cells[x][y];
          if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.settled) { continue; }

          const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
          const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

          const omega = this.tempBuffVec3[x][y];
          const omegaL = this.tempBuffScalar[xm1][y];
          const omegaR = this.tempBuffScalar[xp1][y];
          const omegaB = this.tempBuffScalar[x][ym1];
          const omegaT = this.tempBuffScalar[x][yp1];
          const omegaD = 0, omegaU = 0;
          eta.set(0.5 * (omegaR - omegaL), 0.5 * (omegaT - omegaB), 0.5 * (omegaU - omegaD));
          let len = eta.length() + 1e-6;
          eta.divideScalar(len);
          const vel = this.velField[x][y];
          vel[0] += dtEpsilon * (eta.x*omega[2] - eta.z*omega[1]);
          vel[1] += dtEpsilon * (eta.z*omega[0] - eta.x*omega[2]);
          vel[2] += dtEpsilon * (eta.x*omega[1] - eta.y*omega[0]);
        }
      }
    }
  }

  computeDivergence(cells) {
    const noVel = [0,0,0];
    const size = this.velField.length;
    for (let x = 0; x < this.velField.length; x++) {
      for (let y = 0; y < this.velField[x].length; y++) {
        const cell = cells[x][y];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.settled) { continue; } // Set to 0??

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

        const u = this.velField[x][y];
        // NOTE: If the boundary has a velocity then change noVel to that velocity!
        const fieldL = (cells[xm1][y].type === LiquidCell.SOLID_CELL_TYPE) ? noVel : this.velField[xm1][y];
        const fieldR = (cells[xp1][y].type === LiquidCell.SOLID_CELL_TYPE) ? noVel : this.velField[xp1][y];
        const fieldB = (cells[x][ym1].type === LiquidCell.SOLID_CELL_TYPE) ? noVel : this.velField[x][ym1];
        const fieldT = (cells[x][yp1].type === LiquidCell.SOLID_CELL_TYPE) ? noVel : this.velField[x][yp1];
        const fieldD = noVel;
        const fieldU = noVel;
        this.tempBuffScalar[x][y] = 0.5 * (
          (fieldR[0]-fieldL[0]) + (fieldT[1]-fieldB[1]) + (fieldU[2]-fieldD[2])
        );
      }
    }
  }

  computePressure(cells, numIter=12) {
    for (let x = 0; x < this.pressureField.length; x++) {
      for (let y = 0; y < this.pressureField[x].length; y++) {
        this.pressureField[x][y] = 0;
      }
    }
    const size = this.pressureField.length;
    for (let i = 0; i < numIter; i++) {
      for (let x = 0; x < this.pressureField.length; x++) {
        for (let y = 0; y < this.pressureField[x].length; y++) {
          if (cells[x][y].type === LiquidCell.SOLID_CELL_TYPE || cells[x][y].settled) { continue; }
          const pC = this.pressureField[x][y];
          const bC = this.tempBuffScalar[x][y]; // Contains the 'divergence' calculated previously

          const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
          const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);
          
          let pL = this.pressureField[xm1][y];
          if (cells[xm1][y].type === LiquidCell.SOLID_CELL_TYPE) { pL = pC; }
          let pR = this.pressureField[xp1][y];
          if (cells[xp1][y].type === LiquidCell.SOLID_CELL_TYPE) { pR = pC; }
          let pB = this.pressureField[x][ym1];
          if (cells[x][ym1].type === LiquidCell.SOLID_CELL_TYPE) { pB = pC; }
          let pT = this.pressureField[x][yp1];
          if (cells[x][yp1].type === LiquidCell.SOLID_CELL_TYPE) { pT = pC; }
          //let pD = 0;
          //let pU = 0;
          this.tempPressure = (pL + pR + pB + pT /*+ pU + pD*/ - bC) / 4.0;
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
        if (cells[x][y].type === LiquidCell.SOLID_CELL_TYPE || cells[x][y].settled) { continue; }

        const xm1 = Math.max(0, x-1), xp1 = Math.min(size-1, x+1);
        const ym1 = Math.max(0, y-1), yp1 = Math.min(size-1, y+1);

        const u = this.velField[x][y];
        let pC = this.pressureField[x][y];  
        let pL = this.pressureField[xm1][y], pR = this.pressureField[xp1][y];
        let pB = this.pressureField[x][ym1], pT = this.pressureField[x][yp1];
        //let pD = 0, pU = 0;

        // NOTE: This requires augmentation if the boundaries have velocity!
        const vMaskPos = [1,1];
        const vMaskNeg = [1,1];
        if (cells[xm1][y].type === LiquidCell.SOLID_CELL_TYPE) { pL = pC; vMaskNeg[0] = 0; }
        if (cells[xp1][y].type === LiquidCell.SOLID_CELL_TYPE) { pR = pC; vMaskPos[0] = 0; }
        if (cells[x][ym1].type === LiquidCell.SOLID_CELL_TYPE) { pB = pC; vMaskNeg[1] = 0; }
        if (cells[x][yp1].type === LiquidCell.SOLID_CELL_TYPE) { pT = pC; vMaskPos[1] = 0; }

        u[0] -= 0.5 * (pR-pL);
        u[1] -= 0.5 * (pT-pB);
        //u[2] -= 0.5 * (pU-pD);

        u[0] = Math.max(u[0]*vMaskNeg[0], u[0]);
        u[0] = Math.min(u[0]*vMaskPos[0], u[0]);
        u[1] = Math.max(u[1]*vMaskNeg[1], u[1]);
        u[1] = Math.min(u[1]*vMaskPos[1], u[1]);
      }
    }
  }

  simulate(dt, cells) {
    dt = Math.min(dt, 0.3*this.unitSize/10);
    const {clamp} = THREE.MathUtils;
    let flow = 0;
    this.clearDiffs();

    this.advectVelocity(dt, cells);
    this.applyExternalForces(dt, cells);
    this.applyVorticityConfinement(dt, cells);
    this.computeDivergence(cells);
    this.computePressure(cells);
    this.projectVelocityFromPressure(cells);

    for (let x = 0; x < cells.length; x++) {
      for (let y = 0; y < cells[x].length; y++) {
        const cell = cells[x][y];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE || cell.liquidVol < LiquidSim.LIQUID_EPSILON) {
          cell.liquidVol = 0;
          continue;
        }
        if (cell.settled) { continue; }
 
        const startValue = cell.liquidVol;
        let remainingValue = startValue;
        flow = 0;

        const velocity = this.velField[x][y];
        
        // Flow to bottom cell
        if (cell.bottom && cell.bottom.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateVerticalFlow(remainingValue, cell.bottom) - cell.bottom.liquidVol;
          flowFrac = clamp(flowFrac, 0, Math.min(LiquidSim.MAX_FLOW, remainingValue));
          flow = (flowFrac/LiquidSim.MAX_FLOW)*this.calculateAbsCrossSectionFlow(velocity[1]);
          flow *= this.flowSpeed*dt;
          flow = clamp(flow, 0, remainingValue);
					if (flow !== 0) {
						remainingValue -= flow;
						this.diffs[x][y] -= flow;
						this.diffs[x][y-1] += flow;
						cell.bottom.settled = false;
					}
        }
        else {
          velocity[1] = Math.max(0, velocity[1]);
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }

        // Flow to left and right cells
        if (velocity[0] < 0 && cell.left && cell.left.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateHorizontalFlow(remainingValue, cell.left);
          let minVal = Math.min(LiquidSim.MAX_FLOW, remainingValue);
          flow = (flowFrac/LiquidSim.MAX_FLOW)*this.calculateAbsCrossSectionFlow(velocity[0])*this.flowSpeed*dt;
          flow = clamp(flow, 0, minVal);
          if (flow !== 0) {
						remainingValue -= flow;
						this.diffs[x][y] -= flow;
            this.diffs[x-1][y] += flow;
						cell.left.settled = false;
					}
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }
        if (velocity[0] > 0 && cell.right && cell.right.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateHorizontalFlow(remainingValue, cell.right);
          let minVal = Math.min(LiquidSim.MAX_FLOW, remainingValue);
          flow = (flowFrac/LiquidSim.MAX_FLOW)*this.calculateAbsCrossSectionFlow(velocity[0])*this.flowSpeed*dt;
          flow = clamp(flow, 0, minVal);
          if (flow !== 0) {
						remainingValue -= flow;
						this.diffs[x][y] -= flow;
            this.diffs[x+1][y] += flow;
						cell.right.settled = false;
					} 
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }
        
        // Flow to Top cell
        if (cell.top && cell.top.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = remainingValue - this.calculateVerticalFlow(remainingValue, cell.top); 
          const minVal = Math.min(LiquidSim.MAX_FLOW, remainingValue);
          flowFrac = clamp(flowFrac, 0, minVal);
          flow = flowFrac;
          flow *= this.flowSpeed*dt;
          flow = clamp(flow, 0, minVal);
          if (flow !== 0) {
            remainingValue -= flow;
            this.diffs[x][y] -= flow;
            this.diffs[x][y+1] += flow;
            cell.top.settled = false;
          } 
        }
        else {
          velocity[1] = Math.min(0, velocity[1]);
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }

        // Check if cell is settled
				if (startValue == remainingValue) {
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
    for (let x = 0; x < cells.length; x++) {
      for (let y = 0; y < cells[x].length; y++) {
        const cell = cells[x][y];
        cell.addLiquid(this.diffs[x][y]);
        if (cell.liquidVol < LiquidSim.LIQUID_EPSILON) {
          cell.liquidVol = 0;
          const velocity = this.velField[x][y];
          velocity[0] = 0;
          velocity[1] = 0;
          cell.settled = false;
        }				
      }
    }
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