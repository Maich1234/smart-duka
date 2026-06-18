const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Some packages (e.g. zustand) ship an ESM build with `import.meta.env`
// under the "import" package-exports condition. Metro bundles for web as
// non-module scripts, so `import.meta` there is a parse-time SyntaxError.
// Disabling package-exports resolution falls back to "main"/"browser"
// fields, which resolve to safe CJS builds on every platform.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
