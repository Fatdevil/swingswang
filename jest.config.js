/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // Unit tests (pure logic)
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            moduleResolution: 'node',
            esModuleInterop: true,
            strict: true,
            jsx: 'react-jsx',
            paths: {
              '@/*': ['./src/*'],
            },
          },
        }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      globals: {
        __DEV__: true,
      },
    },
    // Component tests (React element tree analysis, node environment)
    {
      displayName: 'components',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.test.tsx'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            moduleResolution: 'node',
            esModuleInterop: true,
            strict: true,
            jsx: 'react-jsx',
            paths: {
              '@/*': ['./src/*'],
            },
          },
        }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^react-native$': '<rootDir>/tests/setup/react-native-mock.js',
        '^@expo/vector-icons$': '<rootDir>/tests/setup/vector-icons-mock.js',
        '^expo-clipboard$': '<rootDir>/tests/setup/expo-clipboard-mock.js',
      },
      globals: {
        __DEV__: true,
      },
    },
  ],
};
