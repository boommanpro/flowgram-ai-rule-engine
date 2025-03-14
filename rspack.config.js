const path = require('path');

const isCI = process.env.CI === 'true';
const isSCM = !!process.env.BUILD_BRANCH;
const isProd = process.env.NODE_ENV === 'production';
/**
 * @type {import('@rspack/cli').Configuration}
 */
module.exports = {
  mode: process.env.NODE_ENV,
  context: __dirname,
  target: ['web'],
  entry: {
    main: './src/app.tsx',
  },
  resolve: {
    alias: {
      react: require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
    },
  },
  builtins: {
    // https://www.rspack.dev/config/builtins.html#builtinshtml
    html: [
      {
        template: './index.html',
      },
    ],
    progress: !isSCM ? {} : false,
    treeShaking: isProd,
  },
  module: {
    // https://www.rspack.dev/config/module.html#rule
    rules: [
      {
        test: /\.(png|gif|jpg|jpeg|svg|woff2)$/,
        type: 'asset',
      },
      {
        test: /\.(less|css)$/,
        use: [
          {
            loader: 'less-loader',
            options: {
              // ...
            },
          },
        ],
        type: 'css',
      },
    ],
  },
  plugins: [],
  /** module is too large now, we may need better way to tackle this in the future */
  stats: isCI
    ? { all: false, modules: true, assets: true, chunks: true, warnings: true, errors: true }
    : {
        modules: false,
        all: false,
        warnings: false,
        errors: true,
        timings: true,
      },
};
