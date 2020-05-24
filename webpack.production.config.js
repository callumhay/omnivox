const path = require('path');
const nodeExternals = require('webpack-node-externals');

const distPath = path.resolve(__dirname, 'dist');

const commonConfig = {
  mode: 'production',
  optimization: {
    minimize: true,
  },
  node: {
    fs: 'empty',
  },
};


const webClientConfig = {...commonConfig,
  target: 'web',
  entry: {
    main: './src/index.js',
  },
  output: {
    filename: '[name].js',
    path: distPath,
  },
};

const serverConfig = {...commonConfig,
  target: 'node',
  externals: [nodeExternals(), 'serialport'],
  entry: {
    server: './server.js',
  },
  output: {
    filename: '[name].js',
    path: distPath,
  },
};

module.exports = [webClientConfig, serverConfig];
