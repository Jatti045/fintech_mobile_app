/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Stub out native/Expo modules that ship un-transpiled ESM
    "^expo-haptics$": "<rootDir>/__mocks__/expo-haptics.ts",
    "^react-native$": "<rootDir>/__mocks__/react-native.ts",
  },
  // Silence console noise from slices
  silent: true,
};
