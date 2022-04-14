import VoxelConstants from "../../VoxelConstants";
import VTPSpan from "./VTPSpan";

class VTPUtils {

  static initValue(value, defaults) {
    return (value !== null && value !== undefined) ? value : defaults;
  }

  static classApply(constructor, args = null) {
    if (!args) { return new constructor(); } 
    else {
      const factoryFunc = constructor.bind.apply(constructor, [null, ...args]);
      return new factoryFunc();
    }
  }

  static setObjectFromOptions(target, options, filters=null) {
    const _getValue = value => (value instanceof VTPSpan ? value.getValue() : value);
    for (const key in options) {
      if (target.hasOwnProperty(key)) {
        if (filters) {
          if (filters.indexOf(key) < 0) { target[key] = _getValue(options[key]); }
        } 
        else {
            target[key] = _getValue(options[key]);
        }
      }
    }
    return target;
  }

  setVectorsFromOptions(target, options) {
    if (options["x"] !== undefined) target.p.x = options["x"];
    if (options["y"] !== undefined) target.p.y = options["y"];
    if (options["z"] !== undefined) target.p.z = options["z"];

    if (options["vx"] !== undefined) target.v.x = options["vx"];
    if (options["vy"] !== undefined) target.v.y = options["vy"];
    if (options["vz"] !== undefined) target.v.z = options["vz"];

    if (options["ax"] !== undefined) target.a.x = options["ax"];
    if (options["ay"] !== undefined) target.a.y = options["ay"];
    if (options["az"] !== undefined) target.a.z = options["az"];

    if (options["p"] !== undefined) target.p.copy(options["p"]);
    if (options["v"] !== undefined) target.v.copy(options["v"]);
    if (options["a"] !== undefined) target.a.copy(options["a"]);

    if (options["position"] !== undefined) target.p.copy(options["position"]);
    if (options["velocity"] !== undefined) target.v.copy(options["velocity"]);
    if (options["accelerate"] !== undefined) target.a.copy(options["accelerate"]);
  }

  static eulerIntegrate(particle, dt, damping) {
    if (!particle.sleep) {
      particle.old.p.copy(particle.p);
      particle.old.v.copy(particle.v);
      particle.a.multiplyScalar(1.0 / particle.mass);
      particle.v.add(particle.a.multiplyScalar(dt));
      particle.p.add(particle.old.v.multiplyScalar(dt));

      // Only damp the velocity if there is one
      // i.e., friction shouldn't cause things to start moving backwards from their original velocity's direction
      if (damping && particle.v.lengthSq() > VoxelConstants.VOXEL_ERR_UNITS) {
        particle.v.subScalar(dt*damping);
        // Make sure we clamp to a zero velocity if necessary
        if (particle.v.dot(particle.old.v) < 0) { particle.v.set(0,0,0); }
      }
      
      particle.a.set(0,0,0);
    }
  }

}

export default VTPUtils;