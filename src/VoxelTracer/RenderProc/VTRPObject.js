import VTConstants from "../VTConstants";

// Abstract super class for all Voxel Tracer Render Process (VTRP) Objects
class VTRPObject {
  constructor(type) {
    if (this.constructor === VTRPObject) { throw new Error("VTRPObject is an abstract class."); }
    this.id = VTConstants.INVALID_RENDERABLE_ID;
    this.type = type;
    this.drawOrder = VTConstants.DRAW_ORDER_DEFAULT;
  }

  fromJSON(json, pool) { console.error("fromJSON unimplemented abstract method called."); }

  isShadowCaster() { console.error("isShadowCaster unimplemented abstract method called."); return false; }
  isShadowReceiver() { console.error("isShadowReceiver unimplemented abstract method called."); return false; }

  calculateShadow(raycaster=null) { console.error("calculateShadow unimplemented abstract method called."); return null; } 
  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) { console.error("calculateVoxelColour unimplemented abstract method called."); return null; }
}

export default VTRPObject;
