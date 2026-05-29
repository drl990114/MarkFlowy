module.exports = {
  presets: ['@babel/preset-env', '@babel/preset-typescript', '@babel/preset-react'],
  plugins: ['@babel/plugin-transform-runtime'],
  env: {
    esm: {
      presets: [
        [
          '@babel/preset-env',
          {
            modules: false,
          },
        ],
      ],
      plugins: [
        [
          '@babel/plugin-transform-react-jsx',
          {
            runtime: 'automatic',
          }
        ],
        [
          '@babel/plugin-transform-runtime',
          {
            useESModules: true,
          },
        ],
      ],
    },
  },
};
