import * as THREE from 'three';
import VoxelModel from '../../Server/VoxelModel';

// A function prototype shell class for the VTMesh, for use in node.js multithreading
class VTMeshMultithreading {
  constructor(vtMesh) {
    this.material = vtMesh.material;
    this.voxelIdxToTriSamples = vtMesh.voxelIdxToTriSamples;
  }

  calculateVoxelColour(voxelIdxPt, vtSceneMt) {
    let finalColour = new THREE.Color(0,0,0);

    // Fast-out if we can't even see this mesh
    if (!this.material.isVisible()) {
      return finalColour;
    }

    let vtTriSamples = null;
    const voxelIdxLookup = VoxelModel.voxelIdStr(voxelIdxPt);
    if (voxelIdxLookup in this.voxelIdxToTriSamples) {
      vtTriSamples = this.voxelIdxToTriSamples[voxelIdxLookup];
      finalColour.add(vtSceneMt.calculateLightingSamples(vtTriSamples.map(triSample => triSample.sample), this.material));
    }
    
    return finalColour;
  }

}

export default VTMeshMultithreading;