module.exports = {
  verbose: true,
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy',
    '^zens$': '<rootDir>/src/index.ts',
    '^zens/(?:esm|lib)/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src$': '<rootDir>/src/index.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  testRegex: '(/test/.*|\\.(test|spec))\\.(ts|tsx|js)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/lib/', '<rootDir>/esm/', '<rootDir>/dist/'],
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
};
