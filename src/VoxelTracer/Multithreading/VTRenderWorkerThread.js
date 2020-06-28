/*
import {parentPort, workerData, isMainThread} from 'worker_threads';

function threadMain() {
  const renderData = workerData.renderData;
  const sceneModel = workerData.sceneModel;

  const renderables = sceneModel.renderables;
  for (let i = 0; i < renderables.length; i++) {
    const renderable = renderables[i];
    if (typeof renderable.load === "function") {
      renderable.load();
    }
  }

  const result = [];
  for (let i = 0; i < renderData.length; i++) {
    const {voxelIdxPt, visibleRenderableIdx} = renderData[i];
    const renderable = renderables[visibleRenderableIdx];

    const colour = renderable.calculateVoxelColour(voxelIdxPt, sceneModel)
    result.push(colour); //{r: colour.r, g: colour.g, b: colour.b});
  }

  return result;
}

if (!isMainThread) {
  parentPort.postMessage(threadMain());
}
*/