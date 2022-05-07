import InitUtils from '../InitUtils';
import VoxelGeometryUtils from '../VoxelGeometryUtils';

import VTConstants from './VTConstants';
import VTMaterialFactory from './VTMaterialFactory';
import VTTransformable from './VTTransformable';

// TODO: Stop using a THREE.Mesh and just use the geometry along with the VTTransformable matrixWorld
// to save on JSON size overhead in communication to child render processes

class VTMesh extends VTTransformable {
  // NOTE: All geometry MUST be buffer geometry!
  constructor(geometry, material) {
    super(VTConstants.MESH_TYPE);
    
    this.setGeometry(geometry);
    this.material = VTMaterialFactory.initMaterial(material);
  }

  setGeometry(g) {
    this.geometry = g; 
    if (this.geometry) { this.geometry.computeBoundingBox(); }
    this.makeDirty();
    return this;
  }

  toJSON() {
    const {id, drawOrder, type, geometry, matrixWorld, material} = this;
    return {id, drawOrder, type, geometry, matrixWorld:matrixWorld.toArray(), material};
  }

  getCollidingVoxels(voxelGridBoundingBox) {
    const worldSpaceBB = this.geometry.boundingBox.clone().applyMatrix4(this.matrixWorld);
    const {min, max} = worldSpaceBB;
    return VoxelGeometryUtils.voxelAABBList(min, max, true, voxelGridBoundingBox);
  }
}

export default VTMesh;
