import VTMaterial from './VTMaterial';
import VTLambertMaterial from './VTLambertMaterial';
import VTEmissionMaterial from './VTEmissionMaterial';


class VTMaterialFactory {
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

}

export default VTMaterialFactory;