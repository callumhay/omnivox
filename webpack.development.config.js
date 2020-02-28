const path = require('path');

const distPath = path.resolve(__dirname, 'dist');

const commonConfig = {
  mode: 'development',
  optimization: {
    minimize: false,
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
  entry: {
    server: './server.js',
  },
  output: {
    filename: '[name].js',
    path: distPath,
  },
};

module.exports = [webClientConfig, serverConfig];