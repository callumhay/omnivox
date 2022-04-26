import VTConstants from "../VTConstants";
import VTDirectionalLight from "../VTDirectionalLight";
import VTPointLight from "../VTPointLight";
import VTSpotLight from "../VTSpotLight";

import VTRPMesh from "./VTRPMesh";
import VTRPSphere from "./VTRPSphere";
import VTRPVoxel from "./VTRPVoxel";
import VTRPBox from "./VTRPBox";
import {VTRPFogBox, VTRPFogSphere} from "./VTRPFog";
import VTRPIsofield from "./VTRPIsofield";

const vrtpTypeToObjType = {
  [VTConstants.MESH_TYPE]: VTRPMesh,
  [VTConstants.SPHERE_TYPE]: VTRPSphere,
  [VTConstants.BOX_TYPE]: VTRPBox,
  [VTConstants.POINT_LIGHT_TYPE]: VTPointLight,
  [VTConstants.SPOT_LIGHT_TYPE]: VTSpotLight,
  [VTConstants.DIRECTIONAL_LIGHT_TYPE]: VTDirectionalLight,
  [VTConstants.VOXEL_TYPE]: VTRPVoxel,
  [VTConstants.FOG_BOX_TYPE]: VTRPFogBox,
  [VTConstants.FOG_SPHERE_TYPE]: VTRPFogSphere,
  [VTConstants.ISOFIELD_TYPE]: VTRPIsofield,
};

class VRTPObjectFactory {

  static buildFromPool(json, pool) {
    if (!json.type) { console.error("No type found in scene object json!"); return null; }
    if (!(json.type in vrtpTypeToObjType)) { console.error(`Unknown scene object type found (${type}) in object json!`); return null; }
    
    const objType = vrtpTypeToObjType[json.type];
    const obj = pool.get(objType);
    obj.fromJSON(json, pool);
    return obj;
  }

}

export default VRTPObjectFactory;
