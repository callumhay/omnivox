import workerFarm from 'worker-farm';
import VTSceneModel from './VTSceneModel';


class VTSceneMultithreading {
  constructor(voxelModel) {
    this.voxelModel = voxelModel;
    this.sceneModel = new VTSceneModel();

    // Create a thread pool based on the number of cpu cores on this machine
    const cpuCount = os.cpus().length;
    console.log("Initializing thread pool, size: " + cpuCount + "...");
    this.workers = workerFarm(require.resolve('./VTRenderWorker'))
  }

  dispose() {
    this.sceneModel.dispose();
  }

  addLight(l) {
    this.sceneModel.addLight(l);
  }
  addObject(o) {
    this.sceneModel.addObject(o);
  }
  addFog(f) {
    this.sceneModel.addFog(f);
  }
  removeObject(o) {
    this.sceneModel.removeObject(o);
  }

  render() {
    // Get a list of every voxel that will need to be rendered
    const renderData = this.sceneModel.calculateRenderData(this.voxelModel);

    // Split up the voxels evenly among threads
    const numThreads = os.cpus().length;
    const chunkSize = renderData.length / numThreads;
    const splitArrayIntoChunks = (array, chunk_size) => 
      Array(Math.ceil(array.length / chunk_size)).fill().map((_, index) => index * chunk_size).map(begin => array.slice(begin, begin + chunk_size));
    const chunkedRenderData = splitArrayIntoChunks(renderData, chunkSize);

    //console.log(chunkedRenderData);

    const sceneModelMT = new VTSceneModelMultithreading(this.sceneModel);


    for (let i = 0; i < chunkedRenderData.length; i++) {
      (async () => {
        const currRenderData = chunkedRenderData[i];
        const result = await this.threadPool.exec({
          task: threadMain,
          workerData: {
            sceneModel: sceneModelMT,
            renderData: currRenderData,
          },
        });
        
        // The result will be a list of colours that correspond to the given render data
        for (let j = 0; j < result.length; j++) {
          const {voxelObj} = currRenderData[j];
          voxelObj.addColour(result[j]);
        }
      })();
    }
  }
}

export default VTSceneMultithreading;