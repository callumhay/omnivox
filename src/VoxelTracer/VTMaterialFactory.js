import VTMaterial from './VTMaterial';
import VTLambertMaterial from './VTLambertMaterial';
import VTEmissionMaterial from './VTEmissionMaterial';

const materialTypeToObjType = {
  [VTMaterial.LAMBERT_TYPE]: VTLambertMaterial,
  [VTMaterial.EMISSION_TYPE]: VTEmissionMaterial,
};

class VTMaterialFactory {
  static initMaterial(material) {
    return (typeof material === 'string' || material instanceof String) ? VTMaterialFactory.build(material) : 
      !material ? null : material;
  }

  static build(jsonDataOrType) {
    const hasJson = (typeof jsonDataOrType === 'object');
    const type = hasJson ? jsonDataOrType.type : jsonDataOrType;
    let result = null;

    // TODO: Have texture ids to avoid massive duplications here...
    switch (type) {
      case VTMaterial.LAMBERT_TYPE: {
        result = hasJson ? VTLambertMaterial.build(jsonDataOrType) : new VTLambertMaterial();
        break;
      }
      case VTMaterial.EMISSION_TYPE: {
        result = hasJson ? VTEmissionMaterial.build(jsonDataOrType) : new VTEmissionMaterial();
        break;
      }
      default:
        console.error(`Invalid material type: ${type}, found in jsonData: ${jsonDataOrType}`);
        break;
    }
    return result;
  }

  static buildFromPool(json, pool) {
    if (!json.type) { console.error("No type found in material json!"); return null; }
    if (!(json.type in materialTypeToObjType)) { console.error(`Unknown material type found (${type}) in material json!`); return null; }

    const objType = materialTypeToObjType[json.type];
    const material = pool.get(objType);
    material.fromJSON(json, pool);
    return material;
  }

}

export default VTMaterialFactory;
