import VTPUtils from "./VTPUtils";

// Stores a hash table of universal ids that map to specific classes
const VTPUid = {
  _index: 0,
  _cache: {},

  getId(target) {
    let uid = this.getIdFromCache(target);
    if (uid) { return uid; }

    uid = `PUID_${this._index++}`;
    this._cache[uid] = target;
    return uid;
  },

  getIdFromCache(target) {
    let obj, id;
    for (id in this._cache) {
      obj = this._cache[id];
      if (obj === target) { return id; }
    }
    return null;
  },
};

// Keeps a cache that maps specific classes to a list that can be tapped into to
// pop preexisting (i.e., already instantiated) objects of that class and to push them back
// into that cache (i.e., the object pool). This keeps the overhead on the creation of large
// numbers of objects (e.g., particles and the VoxelTracer objects that embody them) to a minimum. 
class VTPPool {
  constructor() {
    this.total = 0;
    this.cache = {};
  }

  get(target, params, uid) {
    let p;
    uid = uid || target.__puid || VTPUid.getId(target);

    if (this.cache[uid] && this.cache[uid].length > 0) { p = this.cache[uid].pop(); } 
    else { p = this.createOrClone(target, params); }

    p.__puid = target.__puid || uid;
    return p;
  }

  expire(target) { return this._getCache(target.__puid).push(target); }

  createOrClone(target, params) {
    this.total++;
    if (typeof target === "function") { return VTPUtils.classApply(target, params); } // e.g., new target(...args);
    return target.clone();
  }

  destroy() {
    for (let id in this.cache) {
      this.cache[id].length = 0;
      delete this.cache[id];
    }
  }

  _getCache(uid = "default") {
    if (!this.cache[uid]) { this.cache[uid] = []; }
    return this.cache[uid];
  }
}

export default VTPPool;
