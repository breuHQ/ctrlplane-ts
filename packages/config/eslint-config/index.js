module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'eslint-plugin-tsdoc'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['node_modules/', '**/dist/**/*.*', '**/build/**/*.js'],
};
