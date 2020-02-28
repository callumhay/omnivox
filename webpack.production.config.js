const path = require('path');

const distPath = path.resolve(__dirname, 'dist');

const webClientConfig = {
  target: 'web',
  mode: 'production',
  entry: {
    main: './src/index.js',
  },
  output: {
    filename: '[name].js',
    path: distPath,
  },
  optimization: {
    minimize: true,
  }
};


const serverConfig = {
  target: 'node',
  mode: 'production',
  entry: {
    server: './server.js',
  },
  output: {
    filename: '[name].js',
    path: distPath,
  },
  optimization: {
    minimize: true,
  }
};


module.exports = [webClientConfig, serverConfig];
