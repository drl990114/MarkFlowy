const fabric = require('@umijs/fabric');

module.exports = {
  ...fabric.prettier,
  plugins: [
    require.resolve('prettier-plugin-packagejson'),
    require.resolve('@trivago/prettier-plugin-sort-imports'),
  ],
  importOrder: ['^react', '<THIRD_PARTY_MODULES>', '^@.*', '^./(.*)', '^../(.*)'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderCaseInsensitive: true,
};
