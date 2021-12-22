const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const distPath = path.resolve(__dirname, 'dist');

const commonConfig = {
  mode: 'production',
  watch: false,
  optimization: {
    minimize: true,
  },
  node: {
    //fs: 'empty',
  },
  plugins: [
    new webpack.DefinePlugin({DEBUG: false}),
    //new webpack.HotModuleReplacementPlugin(),
  ],
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
/*
const webClientDesignerConfig = {...commonConfig,
  target: 'web',
  entry: './src/WebClientDesigner/webclientdesigner.js',
  output: {
    filename: 'webclientdesigner.js',
    path: distPath,
  },
  module: {
    rules: [{
      test: /\.(js|jsx)$/,
      use: ['babel-loader'],
      exclude: /node_modules/
    }]
  }
};
*/
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

module.exports = [webClientViewerConfig, webClientControllerConfig, serverConfig, renderChildConfig];
