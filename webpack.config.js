/* eslint no-unused-vars: 0 */

var webpack = require('webpack');

module.exports = {
  entry: './src/load.js',
  output: {
    path: __dirname,
    filename: './public/bundle.js'
  },
  context: __dirname,
  devtool: 'source-map',
  resolve: {
    extensions: ['.js']
	},
	node: {
		fs: 'empty'
	},
  module: {
    loaders: [
      {
        test: /js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
};
