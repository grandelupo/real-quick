/** Engine tests only — pure TypeScript, no React Native runtime needed. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/engine'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, target: 'es2022', module: 'commonjs', types: ['jest'] } }] },
};
