
const path = require('path');
const nodeExternals = require('webpack-node-externals');

const distPath = path.resolve(__dirname, 'dist');

const commonConfig = {
  mode: 'development',
  watch: true,
  watchOptions: {
    ignored: ['node_modules/**'],
  },
  optimization: {
    minimize: false,
  },
  node: {
    fs: 'empty',
  },
};

const webClientConfig = {...commonConfig,
  target: 'web',
  entry: './src/WebClientViewer/webclientviewer.js',
  output: {
    filename: 'webclientviewer.js',
    path: distPath,
  },
};

const serverConfig = {...commonConfig,
  target: 'node',
  externals: [nodeExternals(), 'serialport'],
  entry: {
    server: './src/Server/server.js',
  },
  output: {
    filename: 'server.js',
    path: distPath,
  },
};

module.exports = [webClientConfig, serverConfig];