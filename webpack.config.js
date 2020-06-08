//@ts-check
'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
const config = {
    target: 'node',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'source-map',
    externals: {
        'vscode': 'commonjs vscode',
        'cesium': 'commonjs cesium',
        'adm-zip': 'commonjs adm-zip',
        'pug-filters': 'commonjs pug-filters'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    }
};

module.exports = config;
