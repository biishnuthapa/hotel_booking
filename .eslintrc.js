// eslintrc.js
module.exports = {
  extends: ['alloy', 'alloy/react', 'alloy/typescript', 'next'],
  env: {
    node: true,
    browser: true,
  },
  globals: {
    REACT_APP_ENV: true,
  },
  rules: {
    'import/no-anonymous-default-export': 'off',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: ['./tsconfig.json', "tsconfig.nextauth.json"],
  },
  ignorePatterns: ['pages/room/bookings/[roomId].jsx', "pages/api/auth/[...nextauth].js"], // Add this line to exclude the file
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
};