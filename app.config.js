// Extends app.json so the Firebase service-config files can be injected by
// EAS file-type environment variables at build time instead of being
// committed to the repo. Falls back to the static local paths from app.json
// for local `expo prebuild`/`expo run` when a developer has the files on disk.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
  ios: {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? config.ios?.googleServicesFile,
  },
});
