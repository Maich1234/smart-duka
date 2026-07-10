const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Some packages (e.g. zustand) ship an ESM build with `import.meta.env`
// under the "import" package-exports condition. Metro bundles for web as
// non-module scripts, so `import.meta` there is a parse-time SyntaxError.
// Disabling package-exports resolution falls back to "main"/"browser"
// fields, which resolve to safe CJS builds on every platform.
config.resolver.unstable_enablePackageExports = false;

// expo-sqlite web support (offline queue): its worker imports
// wa-sqlite.wasm, which Metro must treat as an asset or web bundling fails.
config.resolver.assetExts.push('wasm');

// The sync SQLite API on web runs over SharedArrayBuffer + Atomics, which
// browsers only enable in cross-origin-isolated pages. These headers apply
// to the dev server; a production web host must send the same two headers.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

// expo-router's native-tabs module (unused here — all tab bars are custom JS)
// transitively imports expo-symbols, which would bundle the ~1MB
// MaterialSymbols font. Resolve that font package to an empty module; the
// only code that reads it is the NativeTabs Material icon path, never
// rendered in this app.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@expo-google-fonts/material-symbols')) {
    return { type: 'empty' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
