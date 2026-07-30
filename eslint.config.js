// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Build output and tool scratch dirs. Linting these reported unresolved
    // imports in generated files nobody edits — and `.next/` isn't even this
    // project's, it's left over from running the web app in this folder.
    ignores: ['dist/*', '.next/*', '.expo/*', 'node_modules/*'],
  },
]);
