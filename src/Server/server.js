import path from 'path';
import express from 'express';
import watch from 'watch';
import http from 'http';
import reload from 'reload';

import VoxelServer from './VoxelServer';
import VoxelModel from './VoxelModel';
import VoxelConstants from '../VoxelConstants';

const LOCALHOST_WEB_PORT = 4000;
const DISTRIBUTION_DIRNAME = "dist";

// Create the web server
const app = express();
let distPath = path.resolve();
if (distPath.substring(distPath.length-DISTRIBUTION_DIRNAME.length).toLowerCase() !== DISTRIBUTION_DIRNAME) {
  distPath = path.resolve(distPath, DISTRIBUTION_DIRNAME);
}
console.log("The following directory must be the distribution directory: \"" + distPath + "\"");

app.use(express.static(distPath));
app.use(express.static('textures'));
app.set('port', LOCALHOST_WEB_PORT);
app.get("/viewer", (req, res) => {
  res.sendFile(path.join(distPath, 'webclientviewer.html'));
});
app.get("/controller", (req, res) => {
  res.sendFile(path.join(distPath, 'webclientcontroller.html'));
});
//app.get("/designer", (req, res) => {
//  res.sendFile(path.join(distPath, 'webclientdesigner.html'));
//});


const webServer = http.createServer(app);

reload(app).then((reloadReturned) => {
  // Reload started, start web server
  webServer.listen(app.get('port'), function () {
    console.log('Web server listening on port ' + app.get('port'));
  });

  // Watch this path for changes and reload the browser
  watch.watchTree(distPath, {interval: 1}, function (f, curr, prev) {
    console.log('Tree changed, reloading browser');
    reloadReturned.reload();
  });
}).catch(function (err) {
  console.error('Reload could not start, could not start server/sample app', err)
});



// Create the voxel model - this maintains all of the voxel states and provides the data
// that we send to various clients
const voxelModel = new VoxelModel(VoxelConstants.VOXEL_GRID_SIZE);
//voxelModel.test();

// Create the voxel server - this will handle discovery and transmission of voxel data to both
// hardware clients and to the localhost for virtual display of the voxels
const voxelServer = new VoxelServer(voxelModel);

voxelServer.start();
voxelModel.run(voxelServer);

process.once('SIGINT', function (code) {
  console.log('SIGINT received...');
  voxelServer.stop();
  voxelModel.cleanup();
  webServer.close(() => {
    process.exit(code);
  });
});