/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/android/'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  clearMocks: true,
  // babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` (constants/config.ts)
  // into an import of expo's own virtual env module — a real ESM file on disk,
  // which needs transforming too or Jest chokes on its bare `export`.
  transformIgnorePatterns: ['node_modules/(?!expo/virtual/)'],
};
