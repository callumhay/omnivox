const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const pkg = require('./package');

const distPath = path.resolve(__dirname, 'dist');

const commonConfig = {
  mode: 'production',
  watch: false,
  optimization: {
    minimize: false, // This can't be true, if true gpu.js poops itself
  },
  node: {
    //fs: 'empty',
  },
  plugins: [
    new webpack.DefinePlugin({
      __PROJECT_NAME__ : JSON.stringify(pkg.name),
      __PROJECT_VERSION__ : JSON.stringify(pkg.version),
    }),
  ],
  resolve: {
    fallback: {
      "os": require.resolve("os-browserify/browser"),
      "fs": false,
      "tls": false,
      "net": false,
      "path": false,
      "zlib": false,
      "http": false,
      "https": false,
      "stream": false,
      "crypto": false,
    } 
  }
};

const webClientViewerConfig = {...commonConfig,
  target: 'web',
  entry: './src/WebClientViewer/webclientviewer.js',
  output: {
    filename: 'webclientviewer.js',
    path: distPath,
  },
};
const webClientControllerConfig = {...commonConfig,
  target: 'web',
  entry: './src/WebClientController/webclientcontroller.js',
  output: {
    filename: 'webclientcontroller.js',
    path: distPath,
  },
};
const webClientMicConfig = {...commonConfig,
  target: 'web',
  entry: './src/WebClientMic/webclientmic.js',
  output: {
    filename: 'webclientmic.js',
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

const renderChildConfig = {...commonConfig,
  target: 'node',
  externals: [nodeExternals()],
  entry: {
    vtrenderproc: './src/VoxelTracer/RenderProc/vtrenderprocess.js',
  },
  output: {
    filename: 'vtrenderproc.js',
    path: distPath,
  },
};

module.exports = [
  webClientViewerConfig,
  webClientControllerConfig,
  webClientMicConfig,
  serverConfig,
  renderChildConfig
];
