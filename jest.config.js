/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
    collectCoverageFrom: [
        'app.js',
        'public/validation-rules.js',
        'salesforce.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testMatch: ['**/?(*.)+(spec|test).js'],
    setupFiles: ['<rootDir>/tests/helpers/env.js']
};

