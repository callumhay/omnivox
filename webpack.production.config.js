const path = require('path');
const nodeExternals = require('webpack-node-externals');

const distPath = path.resolve(__dirname, 'dist');

const commonConfig = {
  mode: 'production',
  watch: false,
  optimization: {
    minimize: true,
  },
  node: {
    fs: 'empty',
  },
  plugins: [
    new webpack.DefinePlugin({
      DEBUG: false,
    }),
  ],
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

module.exports = [webClientConfig, serverConfig, renderChildConfig];
