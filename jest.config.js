module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/server.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server.js',
    '!node_modules/**',
    '!coverage/**',
    '!playwright.config.js',
    '!jest.config.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100
    }
  },
  testTimeout: 10000,
  verbose: true
};
