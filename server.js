const path = require('path');
const express = require('express');
const watch = require('watch');
const http = require('http');
const reload = require('reload');

// Create the voxel model - this maintains all of the voxel states and provides the data
// that we send to various clients
/*
const VOXEL_GRID_SIZE = 8;
const VoxelModel = require('./src/VoxelModel');
const voxelModel = new VoxelModel(VOXEL_GRID_SIZE);
*/

// Create the web server
const app = express();
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.set('port', 4000);
app.get("/", (req, res) => {
  res.sendFile(path.join(distPath, index.html));
});

const webServer = http.createServer(app);
reload(app).then((reloadReturned) => {
  // Reload started, start web server
  webServer.listen(app.get('port'), function () {
    console.log('Web server listening on port ' + app.get('port'));
  });

  // Watch this path for changes and reload the browser
  watch.watchTree(path.resolve(__dirname, 'dist'), {interval: 1}, function (f, curr, prev) {
    console.log('Tree changed, reloading browser');
    reloadReturned.reload();
  });
}).catch(function (err) {
  console.error('Reload could not start, could not start server/sample app', err)
});

// Start up the voxel server - this will handle discovery and transmission of voxel data to both
// hardware clients and to the localhost for virtual display of the voxels
const VoxelServer = require('./VoxelServer');
const voxelServer = new VoxelServer();
voxelServer.start();