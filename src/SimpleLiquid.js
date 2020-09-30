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

  }

  step(dt) {
    this.liquidSim.simulate(dt, this.cells);
  }

}

const GRAVITY = 9.81;  // m/s^2
const LIQUID_DENSITY = 1000.0; // kg/m^3
const ATMO_PRESSURE = 10;

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

    this.diffs = new Array(size).fill(null);
    for (let i = 0; i < size; i++) {
      this.diffs[i] = new Array(size).fill(0);
    }
  }

  get unitArea() { return (this.unitSize*this.unitSize); }

  clearDiffs() {
    for (let i = 0; i < this.diffs.length; i++) {
      for (let j = 0; j < this.diffs[i].length; j++) {
        this.diffs[i][j] = 0;
      }
    }
  }

  calculateAbsCrossSectionFlow(component, velocity) {
    // Flow = (Velocity) * (Cross-Section Area)
    return Math.abs(this.calculateCrossSectionFlow(component, velocity));
  }
  calculateCrossSectionFlow(component, velocity) {
    // Flow = (Velocity) * (Cross-Section Area)
    return velocity[component] * this.unitArea;
  }

  calculateVerticalFlow(remainingLiquid, destinationCell) {
    const sum = remainingLiquid + destinationCell.liquidVol;
    let result = 0;
    if (sum < 2*this.maxLiquidVol) {
      result = this.maxLiquidVol;
    }
    else {
      result = 0.5 * sum;
    }
    return result;
  }

  simulate(dt, cells) {
    const {clamp} = THREE.MathUtils;
    let flow = 0;
    this.clearDiffs();

    for (let x = 0; x < cells.length; x++) {
      for (let y = 0; y < cells[x].length; y++) {
        const cell = cells[x][y];
        if (cell.type === LiquidCell.SOLID_CELL_TYPE) { continue; }
        if (cell.liquidVol < LiquidSim.LIQUID_EPSILON) { cell.liquidVol = 0; continue; } // TODO: Remove for GPU
        if (cell.settled) { continue; }
 
        const startValue = cell.liquidVol;
        let remainingValue = startValue;
        flow = 0;

        // Determine the hydrostatic pressure = density*gravity*(height of the fluid above this cell)
        // How much pressure is pressing down on this cell?
        let liquidAboveCell = 0;
        for (let i = y+1; i < Math.min(cells[x].length, y+1+LiquidSim.MAX_PRESSURE_CELL_COUNT); i++) {
          const aboveCell = cells[x][i];
          if (aboveCell.type === LiquidCell.SOLID_CELL_TYPE) { break; }
          else if (aboveCell.type === LiquidCell.EMPTY_CELL_TYPE) {
            if (aboveCell.liquidVol < LiquidSim.LIQUID_EPSILON) { break; }
            liquidAboveCell += aboveCell.liquidVol;
          }
        }

        const mass = LIQUID_DENSITY * cell.liquidVol;
        const hsForce = (ATMO_PRESSURE + liquidAboveCell*GRAVITY*this.unitArea);
        const gravityVel = GRAVITY*dt;
        //const hsVel = hsAccel*dt;
        cell.velocity.set(
          cell.velocity.x, 
          clamp(cell.velocity.y - gravityVel, -10, 10)
        );

        // Flow to bottom cell
        if (cell.bottom && cell.bottom.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = this.calculateVerticalFlow(remainingValue, cell.bottom) - cell.bottom.liquidVol;
          flowFrac = clamp(flowFrac, 0, Math.min(LiquidSim.MAX_FLOW, remainingValue));
          flow = (flowFrac/LiquidSim.MAX_FLOW)*this.calculateAbsCrossSectionFlow('y', cell.velocity);
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
          cell.velocity.y = Math.max(0, cell.velocity.y);
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }

        // Flow to the left cell
        if (cell.left && cell.left.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = (remainingValue - cell.left.liquidVol) / 4.0;
          flow = flowFrac*hsForce;
          flow *= this.flowSpeed*dt;
          flow = clamp(flow, 0, remainingValue);
          if (flow !== 0) {
						remainingValue -= flow;
						this.diffs[x][y] -= flow;
            this.diffs[x-1][y] += flow;
						cell.left.settled = false;
					}
        }
        else {
          cell.velocity.x = Math.max(0, cell.velocity.x);
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }

        // Flow to right cell
				if (cell.right && cell.right.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = (remainingValue - cell.right.liquidVol) / 3.0;
          flow = flowFrac*hsForce;
          flow *= this.flowSpeed*dt;
          flow = clamp(flow, 0, remainingValue);
					if (flow !== 0) {
						remainingValue -= flow;
						this.diffs[x][y] -= flow;
            this.diffs[x+1][y] += flow;
						cell.right.settled = false;
					} 
        }
        else {
          cell.velocity.x = Math.min(0, cell.velocity.x);
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }

        /*
        // Flow to Top cell
        if (cell.top && cell.top.type === LiquidCell.EMPTY_CELL_TYPE) {
          let flowFrac = remainingValue - this.calculateVerticalFlow(remainingValue, cell.top); 
          flowFrac = clamp(flowFrac, 0, Math.min(LiquidSim.MAX_FLOW, remainingValue));
          flow = (flowFrac/LiquidSim.MAX_FLOW)*this.calculateAbsCrossSectionFlow('y', cell.velocity);
          flow *= this.flowSpeed*dt;
          flow = clamp(flow, 0, remainingValue);
          if (flow !== 0) {
            remainingValue -= flow;
            this.diffs[x][y] -= flow;
            this.diffs[x][y+1] += flow;
            cell.top.settled = false;
          } 
        }
        else {
          cell.velocity.y = Math.min(0, cell.velocity.y);
        }
        if (remainingValue < LiquidSim.LIQUID_EPSILON) {
          this.diffs[x][y] -= remainingValue;
          continue;
        }
        */

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
          cell.velocity.set(0,0);
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
    this.velocity = new THREE.Vector2(0,0);
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