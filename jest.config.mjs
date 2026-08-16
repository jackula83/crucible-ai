/**
 * Plain .mjs so Jest needs no TypeScript loader (ts-node / type stripping)
 * to read its own config — works on every Node >=22.
 * @type {import('jest').Config}
 */
export default {
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
};
