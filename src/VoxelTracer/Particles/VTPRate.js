
import VTPSpan from './VTPSpan';
import VTPUtils from './VTPUtils';

/**
  * The number of particles per second emission (a [particle]/b [s]);
  * @param {Array or Number or Proton.Span} numPan the value generated/output at each emission
  * @param {Array or Number or Proton.Span} timePan the time of each emission
  * for example: new VTPRate(new VTPSpan(10, 20), new VTPSpan(.1, .25));
  */
class VTPRate {
  constructor(numPan, timePan) {
    this.numPan  = VTPSpan.createSpan(VTPUtils.initValue(numPan, 1));
    this.timePan = VTPSpan.createSpan(VTPUtils.initValue(timePan, 1));

    this.startTime = 0;
    this.nextTime = 0;
    this.init();
  }

  init() {
    this.startTime = 0;
    this.nextTime = this.timePan.getValue();
  }

  getValue(dt) {
    this.startTime += dt;
    if (this.startTime >= this.nextTime) {
      this.init();
      if (this.numPan.b == 1) { return this.numPan.getValue("Float") > 0.5 ? 1 : 0; } 
      else { return this.numPan.getValue(true); }
    }
    return 0;
  }

}

export default VTPRate;