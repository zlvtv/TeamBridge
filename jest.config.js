/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|tsx|js)$',
  moduleDirectories: ['node_modules', 'src'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/test/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/jest.setup.js'],
  clearMocks: true,
  resetMocks: true,
  coverageDirectory: 'coverage',
};
