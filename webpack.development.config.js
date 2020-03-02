const path = require('path');
const nodeExternals = require('webpack-node-externals');

const distPath = path.resolve(__dirname, 'dist');

const commonConfig = {
  mode: 'development',
  optimization: {
    minimize: false,
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
  externals: [nodeExternals()],
  entry: {
    server: './src/Server/server.js',
  },
  output: {
    filename: 'server.js',
    path: distPath,
  },
};

module.exports = [webClientConfig, serverConfig];