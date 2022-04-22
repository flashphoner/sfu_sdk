const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: path.resolve(__dirname, 'src/sfu.ts'),
    module: {
        rules: [
            {
                test: /\.ts?$/,
                loader: 'ts-loader'
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'sfu.js',
        library: "SFU",
        libraryTarget: "var",
        globalObject: "global",
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: path.resolve(__dirname, "src/**/*"),
                  to({ context, absoluteFilename }) {
                     return `${path.relative(context, absoluteFilename).replace(/^src\//g, "")}`;
                  },
                  info: { minimized: false },
                  globOptions: {
                     ignore: [ "**/*.ts" ]
                  }
                }
            ],
        })
    ]
};

