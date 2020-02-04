const path = require('path');
const express = require('express');
const server = express();

server.use(express.static(path.join(__dirname, 'dist')));

server.get("/", (req, res) => {
  res.sendFile(__dirname + '/dist/index.html');
});

const port = 4000;

server.listen(port, () => {
  console.log(`Server listening at ${port}`);
});