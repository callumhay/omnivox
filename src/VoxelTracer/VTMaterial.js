
class VTMaterial {
  static get LAMBERT_TYPE()  { return 'l'; }
  static get EMISSION_TYPE() { return 'e'; }

  constructor(type) {
    this.type = type;
  }

  isEmissionOnly() { return false; }
  isVisible() { console.error("isVisible unimplemented abstract method called."); return true; }

  albedo(targetRGBA, uv) { console.error("albedo unimplemented abstract method called.");  return null; }
  brdf(targetRGBA, nObjToLightVec, normal, uv, lightColour) { console.error("brdf unimplemented abstract method called.");  return null; }
  brdfAmbient(targetRGBA, uv, lightColour) { console.error("brdfAmbient unimplemented abstract method called.");  return null; }
  basicBrdfAmbient(targetRGBA, uv, lightColour) { console.error("basicBrdfAmbient unimplemented abstract method called.");  return null; }
}

export default VTMaterial;