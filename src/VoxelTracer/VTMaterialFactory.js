import VTMaterial from './VTMaterial';
import VTLambertMaterial from './VTLambertMaterial';
import VTEmissionMaterial from './VTEmissionMaterial';


class VTMaterialFactory {
  static build(jsonData) {
    const {type} = jsonData;
    let result = null;

    // TODO: Have texture ids to avoid massive duplications here...

    switch (type) {
      case VTMaterial.LAMBERT_TYPE: {
        result = VTLambertMaterial.build(jsonData);
        break;
      }
      case VTMaterial.EMISSION_TYPE: {
        result = VTEmissionMaterial.build(jsonData);
        break;
      }
      default:
        console.error(`Invalid material type: ${type}, found in jsonData: ${jsonData}`);
        break;
    }
    return result;
  }
}

export default VTMaterialFactory;