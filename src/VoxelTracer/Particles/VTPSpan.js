import { Randomizer } from '../../Randomizers';
import VTPUtils from './VTPUtils';

class VTPSpan { // extends VTPZone???

  /**
   * Get a random Number from a to b.
   * @param {Number|Array} a - min number
   * @param {Number} b - max number
   */
  constructor(a, b) {
    this._isArray = false;
    if (Array.isArray(a)) {
      this._isArray = true;
      this.a = a;
    } 
    else {
      this.a = VTPUtils.initValue(a, 1);
      this.b = VTPUtils.initValue(b, this.a);
    }
  }

  getValue(isInt) {
    if (this._isArray) { return this.a[(this.a.length * Math.random()) >> 0]; } 
    return isInt ? Randomizer.getRandomInt(this.a, this.b) : Randomizer.getRandomFloat(this.a, this.b);
  }

  /**
   * @param {number} a min number
   * @param {number} b max number (optional)
   * @returns {VTPSpan} Instance of VTPSpan
   */
  static createSpan(a, b) {
    if (a instanceof VTPSpan) { return a; }
    if (b === undefined) { return new VTPSpan(a); } 
    return new VTPSpan(a, b);
  }

}

export default VTPSpan;