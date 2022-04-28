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

const vrtpTypeMap = {
  [VTConstants.MESH_TYPE]:              {type: VTRPMesh, preloadAmt: 1},
  [VTConstants.SPHERE_TYPE]:            {type: VTRPSphere, preloadAmt: 3},
  [VTConstants.BOX_TYPE]:               {type: VTRPBox, preloadAmt: 8},
  [VTConstants.POINT_LIGHT_TYPE]:       {type: VTPointLight, preloadAmt: 3},
  [VTConstants.SPOT_LIGHT_TYPE]:        {type: VTSpotLight, preloadAmt: 1},
  [VTConstants.DIRECTIONAL_LIGHT_TYPE]: {type: VTDirectionalLight, preloadAmt: 1},
  [VTConstants.AMBIENT_LIGHT_TYPE]:     {type: VTAmbientLight, preloadAmt: 1},
  [VTConstants.VOXEL_TYPE]:             {type: VTRPVoxel, preloadAmt: 10},
  [VTConstants.FOG_BOX_TYPE]:           {type: VTRPFogBox, preloadAmt: 1},
  [VTConstants.FOG_SPHERE_TYPE]:        {type: VTRPFogSphere, preloadAmt: 1},
  [VTConstants.ISOFIELD_TYPE]:          {type: VTRPIsofield, preloadAmt: 1},

  [VTMaterial.EMISSION_TYPE]: {type: VTEmissionMaterial, preloadAmt: 20},
  [VTMaterial.LAMBERT_TYPE]:  {type: VTLambertMaterial, preloadAmt: 20},
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
    if (!(json.type in vrtpTypeMap)) { console.error(`Unknown scene object type found (${type}) in object json!`); return null; }
    
    const objType = vrtpTypeMap[json.type].type;
    const obj = pool.get(objType);
    obj.fromJSON(json, pool);
    return obj;
  }

  static preloadSceneObjects(pool) {
    for (const value of Object.values(vrtpTypeMap)) {
      pool.preload(value.preloadAmt, value.type);
    }
  }

}

export default VTRPObjectFactory;
