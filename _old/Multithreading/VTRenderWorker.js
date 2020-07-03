import {parentPort, workerData} from 'worker_threads';

function renderableDataToObj(renderableData) {
  
  switch (renderableData.type) {
    
    default:
      break;
  }

  return null;
}

function threadMain() {
  const renderData  = workerData.renderData;
  const sceneModel  = workerData.sceneModel;

  const result = [];
  for (let i = 0; i < renderData.length; i++) {
    const {voxelIdxPt, renderableData} = renderData[i];
    const renderable = renderables[visibleRenderableIdx];
    result.push(renderable.calculateVoxelColour(voxelIdxPt, sceneModel)); //{r: colour.r, g: colour.g, b: colour.b});
  }

  return result;
}

parentPort.postMessage(threadMain());
