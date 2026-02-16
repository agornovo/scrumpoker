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
  testTimeout: 10000,
  verbose: true
};
