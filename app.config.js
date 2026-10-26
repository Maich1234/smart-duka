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
module.exports = ({ config }) => ({
  ...config,
  // APK previews target one CPU architecture. Production AABs retain every
  // default ABI so Google Play can deliver the correct split to each phone.
  plugins: (config.plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') return plugin;
    const architectures = process.env.DUQANA_ANDROID_ARCHS?.split(',').filter(Boolean);
    return [plugin[0], {
      ...plugin[1],
      android: {
        ...plugin[1]?.android,
        enableBundleCompression: true,
        ...(architectures?.length ? { buildArchs: architectures } : {}),
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
});
