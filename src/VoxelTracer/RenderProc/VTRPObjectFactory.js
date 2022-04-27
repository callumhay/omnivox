import VTConstants from "../VTConstants";
import VTDirectionalLight from "../VTDirectionalLight";
import VTPointLight from "../VTPointLight";
import VTSpotLight from "../VTSpotLight";
import VTAmbientLight from "../VTAmbientLight";
import VTEmissionMaterial from "../VTEmissionMaterial";
import VTLambertMaterial from "../VTLambertMaterial";

import VTRPMesh from "./VTRPMesh";
import VTRPSphere from "./VTRPSphere";
import VTRPVoxel from "./VTRPVoxel";
import VTRPBox from "./VTRPBox";
import {VTRPFogBox, VTRPFogSphere} from "./VTRPFog";
import VTRPIsofield from "./VTRPIsofield";
import VTMaterial from "../VTMaterial";

const vrtpTypeToObjType = {
  [VTConstants.MESH_TYPE]: VTRPMesh,
  [VTConstants.SPHERE_TYPE]: VTRPSphere,
  [VTConstants.BOX_TYPE]: VTRPBox,
  [VTConstants.POINT_LIGHT_TYPE]: VTPointLight,
  [VTConstants.SPOT_LIGHT_TYPE]: VTSpotLight,
  [VTConstants.DIRECTIONAL_LIGHT_TYPE]: VTDirectionalLight,
  [VTConstants.AMBIENT_LIGHT_TYPE]: VTAmbientLight,
  [VTConstants.VOXEL_TYPE]: VTRPVoxel,
  [VTConstants.FOG_BOX_TYPE]: VTRPFogBox,
  [VTConstants.FOG_SPHERE_TYPE]: VTRPFogSphere,
  [VTConstants.ISOFIELD_TYPE]: VTRPIsofield,

  [VTMaterial.EMISSION_TYPE]: VTEmissionMaterial,
  [VTMaterial.LAMBERT_TYPE]: VTLambertMaterial,
};

class VTRPObjectFactory {

  static isRenderable(objOrJson) {
    const {type} = objOrJson;
    switch (type) {
      case VTConstants.AMBIENT_LIGHT_TYPE:
      case VTConstants.DIRECTIONAL_LIGHT_TYPE:
        return false;
      default:
        return true;
    }
  }

  static isLight(objOrJson, includeAmbient=false) {
    const {type} = objOrJson;
    switch (type) {
      case VTConstants.DIRECTIONAL_LIGHT_TYPE:
      case VTConstants.POINT_LIGHT_TYPE:
      case VTConstants.SPOT_LIGHT_TYPE:
        return true;
      case VTConstants.AMBIENT_LIGHT_TYPE:
        return includeAmbient;
      default:
        return false;
    }
  }

  static updateOrBuildFromPool(json, pool, obj) {
    if (obj) {
      if (!json.type) { console.error("No type found in scene object json!"); return null; }
      if (obj.type === json.type) {
        return obj.fromJSON(json, pool);
      }
      pool.expire(obj); // The object isn't the same type, return it to the pool and continue on to build the object
    }
    return VTRPObjectFactory.buildFromPool(json, pool);
  }

  static buildFromPool(json, pool) {
    if (!json.type) { console.error("No type found in scene object json!"); return null; }
    if (!(json.type in vrtpTypeToObjType)) { console.error(`Unknown scene object type found (${type}) in object json!`); return null; }
    
    const objType = vrtpTypeToObjType[json.type];
    const obj = pool.get(objType);
    obj.fromJSON(json, pool);
    return obj;
  }

}

export default VTRPObjectFactory;
