const path = require('path');

module.exports = {
  resolve: {
    alias: {
      '@material-ui/core': path.resolve(__dirname, 'node_modules/@material-ui/core'),
      '@material-ui/icons': path.resolve(__dirname, 'node_modules/@material-ui/icons'),
    },
  },
  // otras configuraciones de webpack...
};
