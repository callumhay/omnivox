import VTAmbientLight from '../VTAmbientLight';

class VTSceneModel {
  constructor() {
    this.isDirty = false;

    // TODO: Octree... for faster ray collisions etc.
    this.renderables = [];
    this.shadowCasters = [];
    this.lights = [];

    this.ambientLight = null;
  }

  dispose() {
    this.renderables.forEach(renderable => {
      renderable.dispose();
    });

    this.renderables = [];
    this.lights = [];
    this.shadowCasters = [];
    this.ambientLight = null;
    this.isDirty = false;
  }

  addLight(l) {
    if (l instanceof VTAmbientLight) {
      this.ambientLight = l;
    }
    else {
      this.renderables.push(l);
      this.lights.push(l);
    }
    this.isDirty = true;
  }
  addObject(o) {
    this.renderables.push(o);
    this.shadowCasters.push(o);
    this.isDirty = true;
  }
  addFog(f) {
    this.addObject(f);
  }

  removeObject(o) {
    let index = this.renderables.indexOf(o);
    if (index > -1) {
      this.renderables.splice(index, 1);
    }
    index = this.shadowCasters.indexOf(o);
    if (index > -1) {
      this.shadowCasters.splice(index, 1);
    }

    this.isDirty = true;
  }

  calculateRenderData(voxelModel) {
    const boundingBox = voxelModel.getBoundingBox();
    // Find all renderable entities that exist within the bounds of the voxels (i.e., visible entities)
    const visibleRenderables = [];
    for (let i = 0; i < this.renderables.length; i++) {
      const renderable = this.renderables[i];
      if (renderable.intersectsBox(boundingBox)) {
        visibleRenderables.push(renderable);
      }
    }

    // Pre-render the scene to make sure all meshes have been updated/memoized
    if (this.isDirty) {
      for (let i = 0; i < visibleRenderables.length; i++) {
        const renderable = visibleRenderables[i];
        const voxelIndexPoints = renderable.getCollidingVoxels();
        for (let j = 0; j < voxelIndexPoints.length; j++) {
          const voxelIdxPt = voxelIndexPoints[j];
          renderable.preRender(voxelIdxPt);
        }
      }
      this.isDirty = false;
    }

    const renderData = [];
    for (let i = 0; i < visibleRenderables.length; i++) {
      // Get all of the voxels that collide with the renderable object
      const renderable = visibleRenderables[i];
      const voxelIndexPoints = renderable.getCollidingVoxels();
      const currRenderData = voxelIndexPoints.map((voxelIdxPt) => {
        const voxelObj = voxelModel.getVoxel(voxelIdxPt);
        return {
          voxelIdxPt: voxelIdxPt,
          voxelObj: voxelObj,
          renderableData: renderable.toPlainData(),
        };
      }).filter(value => value.voxelObj);
      Array.prototype.push.apply(renderData, currRenderData);
    }

    return renderData;
  }
}

export default VTSceneModel;