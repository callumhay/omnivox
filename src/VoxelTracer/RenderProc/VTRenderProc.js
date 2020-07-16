import VTRPScene from "./VTRPScene";
import VoxelModel from "../../Server/VoxelModel";

class VTRenderProc {
  static get TO_PROC_INIT() { return 'i'; }
  static get TO_PROC_UPDATE_SCENE() { return 'u'; }
  static get TO_PROC_UPDATE_VOXEL_INFO() { return 'm'; }
  static get TO_PROC_RENDER() { return 'r'; }
  
  static get FROM_PROC_RENDERED() { return 'f'; }

  constructor() {
    this.rpScene = new VTRPScene();
    this.renderableToVoxelMapping = {};
    this.voxelIndexRange = [0,0];
  }

  run() {
    process.on('message', message => {
      const {type, data} = message;

      switch (type) {
        case VTRenderProc.TO_PROC_INIT: {
          const {gridSize, voxelIndexRange} = data;
          this.rpScene.gridSize = parseInt(gridSize);
          this.voxelIndexRange = voxelIndexRange;
          break;
        }

        case VTRenderProc.TO_PROC_UPDATE_SCENE: {
          const {removedIds} = data;
          // The data is an object with all of the scene objects that need to be updated inside of it
          this.rpScene.update(data);
          // Remove mappings if necessary
          if (removedIds) {
            for (let i = 0; i < removedIds.length; i++) {
              const removedId = removedIds[i];
              delete this.renderableToVoxelMapping[removedId];
            }
          }

          break;
        }

        case VTRenderProc.TO_PROC_UPDATE_VOXEL_INFO: {
          if (data.reinit) {
            this.renderableToVoxelMapping = data.mapping;
          }
          else {
            const {mapping, updatedRenderableVoxels} = data;
            if (this.renderableToVoxelMapping.length === 0) {
              // In this case it's likely that this is the first call with new scene data,
              // in this case we just make it our direct mapping
              this.renderableToVoxelMapping = mapping;
            }
            else {
              Object.entries(mapping).forEach(entry => {
                this.renderableToVoxelMapping[entry[0]] = entry[1];
              });

              // Update renderable to voxel mappings - we may no longer be rendering some of the assets that got updated 
              // if an asset changed positions to voxel(s) that this child doesn't render or vice versa)
              const newRenderableToVoxelPtsMappings = {};
              for (let i = 0; i < updatedRenderableVoxels.length; i++) {
                const {voxelPt, renderableId} = updatedRenderableVoxels[i];

                if (!(renderableId in newRenderableToVoxelPtsMappings)) {
                  newRenderableToVoxelPtsMappings[renderableId] = [];
                }

                // If the voxel point is going to be rendered by this process then we include it
                const voxelIdx = VoxelModel.voxelFlatIdx(voxelPt, this.rpScene.gridSize);
                if (voxelIdx >= this.voxelIndexRange[0] && voxelIdx <= this.voxelIndexRange[1]) {
                  newRenderableToVoxelPtsMappings[renderableId].push(voxelPt);
                }
              }

              Object.entries(newRenderableToVoxelPtsMappings).forEach(entry => {
                const [renderableId, voxelPts] = entry;
                delete this.renderableToVoxelMapping[renderableId];
                if (voxelPts.length > 0) {
                  this.renderableToVoxelMapping[renderableId] = voxelPts;
                }
              });
            }
          }
          
          break;
        }

        case VTRenderProc.TO_PROC_RENDER:
          this.rpScene.render(this.renderableToVoxelMapping);
          break;

        default:
          console.error(`Invalid message type received by child render process: ${message.type}`);
          break;
      }
    });
  }

}

export default VTRenderProc;