module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // unstable_transformImportMeta: rewrites `import.meta` to a safe
      // globalThis stub on web. Off by default for client bundles, but some
      // packages (e.g. zustand's ESM build) ship raw `import.meta.env`,
      // which is a parse-time SyntaxError in Metro's non-module web output.
      ['babel-preset-expo', { web: { unstable_transformImportMeta: true } }],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
