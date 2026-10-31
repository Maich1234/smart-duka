// Extends app.json so the Firebase service-config files can be injected by
// EAS file-type environment variables at build time instead of being
// committed to the repo. Falls back to the static local paths from app.json
// for local `expo prebuild`/`expo run` when a developer has the files on disk.
//
// SECURITY: Only google-services.json / GoogleService-Info.plist (client-side
// Firebase config) belong here. The Firebase Admin SDK service account key
// MUST NEVER be added to this project — it grants full admin-level Firebase
// access and must remain server-side only (e.g. Vercel environment variables).
// If a service account key is accidentally exposed, rotate it immediately at:
// Firebase Console → Project Settings → Service Accounts → Generate new private key.
module.exports = ({ config }) => {
  const apkTarget = process.env.DUQANA_APK_TARGET;
  if (apkTarget && !['phones', 'arm64'].includes(apkTarget)) {
    throw new Error('DUQANA_APK_TARGET must be phones or arm64.');
  }
  return {
    ...config,
    // APK-only size options. Keep production App Bundles and development
    // emulator builds on Expo's defaults; Google Play splits App Bundles.
    plugins: (config.plugins ?? []).map(plugin => {
      if (!apkTarget || !Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') return plugin;
      const [name, options = {}] = plugin;
      return [name, {
        ...options,
        android: {
          ...options.android,
          buildArchs: apkTarget === 'arm64' ? ['arm64-v8a'] : ['armeabi-v7a', 'arm64-v8a'],
          enableBundleCompression: true,
          useLegacyPackaging: true,
        },
      }];
    }),
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
    },
    ios: {
      ...config.ios,
      googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? config.ios?.googleServicesFile,
    },
  };
};
