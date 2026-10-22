const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// Use separate resource names so the original Expo bitmaps remain available
// inside the inset. Splash and web assets are deliberately independent.
module.exports = function withSmallLauncher(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
    const write = (folder, name, xml) => {
      fs.mkdirSync(path.join(res, folder), { recursive: true });
      fs.writeFileSync(path.join(res, folder, name + '.xml'), xml + '\n');
    };
    const ns = 'xmlns:android="http://schemas.android.com/apk/res/android"';
    for (const [name, original] of [
      ['barricade_launcher', 'ic_launcher'],
      ['barricade_launcher_round', 'ic_launcher_round'],
    ]) {
      write('mipmap-anydpi', name,
        '<layer-list ' + ns + '><item><shape><solid android:color="#000000"/></shape></item>' +
        '<item><inset android:drawable="@mipmap/' + original + '" android:insetLeft="8dp" android:insetTop="8dp" android:insetRight="8dp" android:insetBottom="8dp"/></item></layer-list>');
      write('mipmap-anydpi-v26', name,
        '<adaptive-icon ' + ns + '><background android:drawable="@android:color/black"/>' +
        '<foreground android:drawable="@drawable/barricade_launcher_foreground"/></adaptive-icon>');
    }
    write('drawable', 'barricade_launcher_foreground',
      '<inset ' + ns + ' android:drawable="@mipmap/ic_launcher_foreground" android:insetLeft="18%" android:insetTop="18%" android:insetRight="18%" android:insetBottom="18%"/>');
    application.$['android:icon'] = '@mipmap/barricade_launcher';
    application.$['android:roundIcon'] = '@mipmap/barricade_launcher_round';
    return mod;
  });
};
