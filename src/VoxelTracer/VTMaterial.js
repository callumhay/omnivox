
class VTMaterial {
  static get LAMBERT_TYPE()  { return 'l'; }
  static get EMISSION_TYPE() { return 'e'; }

  constructor(type) {
    this.type = type;
  }

  isVisible() { console.error("isVisible unimplemented abstract method called."); return true; }
  albedo(uv) { console.error("albedo unimplemented abstract method called.");  return null; }
  brdf(nObjToLightVec, normal, uv, lightColour) { console.error("brdf unimplemented abstract method called.");  return null; }
  brdfAmbient(uv, lightColour) { console.error("brdfAmbient unimplemented abstract method called.");  return null; }
}

export default VTMaterial;