import InitUtils from "../InitUtils";

// Stores a hash table of universal ids that map to specific classes
const VTUid = {
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
class VTPool {
  constructor() {
    this.total = 0;
    this.cache = {};
  }

  preload(num, target, params) {
    for (let i = 0; i < num; i++) {
      const preloadedObj = this.get(target, params);
      this.expire(preloadedObj);
    }
  }

  get(target, params, uid) {
    let p;
    uid = uid || target.__vtuid || VTUid.getId(target);

    if (this.cache[uid] && this.cache[uid].length > 0) { p = this.cache[uid].pop(); } 
    else { p = this.createOrClone(target, params); }

    p.__vtuid = target.__vtuid || uid;
    return p;
  }

  expire(target) { return this._getCache(target.__vtuid).push(target); }

  createOrClone(target, params) {
    this.total++;
    return InitUtils.classApply(target, params);
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

export default VTPool;
