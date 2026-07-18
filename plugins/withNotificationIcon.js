const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Android renders FCM notification-tray icons by masking the app's launcher
// icon to a white silhouette when no dedicated icon is configured — since the
// launcher icon is full-color and fills its whole canvas, that mask collapses
// to a blank white square (the bug this plugin fixes). This copies a
// pre-generated white-on-transparent silhouette into res/drawable-*dpi so
// Android has a real icon to mask instead.
//
// The RNFB messaging Expo plugin (@react-native-firebase/messaging, already
// applied via app.json) reads `expo.notification.icon` and wires up the
// AndroidManifest <meta-data> pointing at @drawable/notification_icon — this
// plugin only needs to make sure that drawable resource actually exists,
// since Expo's own SDK no longer generates it automatically.
const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

const withNotificationIcon = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

      for (const density of DENSITIES) {
        const src = path.join(
          projectRoot,
          'assets',
          'notification-icon',
          `notification_icon_${density}.png`
        );
        if (!fs.existsSync(src)) continue;

        const destDir = path.join(resDir, `drawable-${density}`);
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, path.join(destDir, 'notification_icon.png'));
      }

      return config;
    },
  ]);
};

module.exports = withNotificationIcon;
