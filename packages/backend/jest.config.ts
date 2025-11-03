import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  // Use the ts-jest preset for ESM
  preset: 'ts-jest/presets/default-esm',

  // The test environment that will be used for testing
  testEnvironment: 'node',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src'],

  // The glob patterns Jest uses to detect test files
  testRegex: '.*\\.spec\\.ts$',

  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.ts?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
    // '^.+\\.[tj]s$': 'ts-jest' // This is handled by the preset
  },

  // Helps Jest resolve TypeScript paths
  moduleNameMapper: {
    // This mapping is necessary to handle the .js extension in ESM imports
    '^(\\.{1,2}/.*)\\.js$': '$1',

    // If you use path aliases in tsconfig.json, map them here
    // Example: '@App/(.*)': '<rootDir>/src/$1'
  },

  // An array of file extensions your modules use
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};

export default config;
