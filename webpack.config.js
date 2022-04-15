const path = require('path');

module.exports = {
    entry: './examples/sfu.ts',
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'sfu.js',
        library: "SFU",
        libraryTarget: "var",
        globalObject: "global",
        path: path.resolve(__dirname, 'examples'),
    },
};

