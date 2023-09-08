
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");
const distPath = path.resolve(__dirname, 'dist');
const pkg = require('./package');

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
    //fs: 'empty',
  },
  plugins: [
    new webpack.DefinePlugin({
      __PROJECT_NAME__ : JSON.stringify(pkg.name),
      __PROJECT_VERSION__ : JSON.stringify(pkg.version + " [dev]"),
    }),
  ],
  devtool: "source-map",
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
  plugins: [...commonConfig.plugins,
    new CopyPlugin({
      patterns: [
        {from: './node_modules/emulators/dist', to: './dos'},
      ],
    }),
  ],
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
  devServer: {
    writeToDisk: true,
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