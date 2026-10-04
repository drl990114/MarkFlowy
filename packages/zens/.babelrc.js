module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
    ['babel-plugin-module-resolver', { alias: { '@': './src' } }],
  ],
  env: {
    esm: {
      presets: [['@babel/preset-env', { modules: false }]],
      plugins: [['@babel/plugin-transform-runtime', { useESModules: true }]],
    },
  },
};
