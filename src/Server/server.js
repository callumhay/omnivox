import path from 'path';
import express from 'express';
import watch from 'watch';
import http from 'http';
import reload from 'reload';

import VoxelModel from './VoxelModel';
import VoxelServer from './VoxelServer';

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
app.get("/", (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});


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
const VOXEL_GRID_SIZE = 8;
const voxelModel = new VoxelModel(VOXEL_GRID_SIZE);

// Create the voxel server - this will handle discovery and transmission of voxel data to both
// hardware clients and to the localhost for virtual display of the voxels
const voxelServer = new VoxelServer(voxelModel);


voxelServer.start();
voxelModel.run(voxelServer);


/*
// THIS CODE DOESN'T WORK ON NON-WINDOWS SYSTEMS!
// When this app is killed (Ctrl+C) we need to do some clean-up
const onKill = () => {
  voxelServer.stop();
  console.log("Voxel server stopped.");
  webServer.close(() => {
    console.log("Webserver closed.");
  });
}
process.on('SIGTERM', () => {
  onKill();
});
process.on('SIGKILL', () => {
  onKill();
});
*/