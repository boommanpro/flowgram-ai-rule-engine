import * as RefreshPlugin from '@rspack/plugin-react-refresh';
import { rspack } from '@rspack/core';
import { defineConfig } from '@rspack/cli';

const isDev = process.env.NODE_ENV === 'development';
const isCI = process.env.CI === 'true';
const isSCM = !!process.env.BUILD_BRANCH;
const isProd = process.env.NODE_ENV === 'production';
// Target browsers, see: https://github.com/browserslist/browserslist
const targets = ['chrome >= 87', 'edge >= 88', 'firefox >= 78', 'safari >= 14'];

export default defineConfig({
  context: __dirname,
  entry: {
    main: './src/main.tsx',
  },
  resolve: {
    extensions: ['...', '.ts', '.tsx', '.jsx'],
  },
  module: {
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
      {
        test: /\.(jsx?|tsx?)$/,
        exclude: /node_modules\/monaco-editor/, // 排除 monaco-editor
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: isDev,
                    refresh: isDev,
                  },
                },
              },
              env: { targets },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: './index.html',
    }),
    isDev ? new RefreshPlugin() : null, // 仅在开发环境中启用
  ].filter(Boolean),
  optimization: {
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin(),
      new rspack.LightningCssMinimizerRspackPlugin({
        minimizerOptions: { targets },
      }),
    ],
  },
  experiments: {
    css: true,
  },
  stats: isCI
    ? { all: false, modules: true, assets: true, chunks: true, warnings: true, errors: true }
    : {
        modules: false,
        all: false,
        warnings: false,
        errors: true,
        timings: true,
      },
});
