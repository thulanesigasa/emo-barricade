# Barricade

An offline Expo / React Native strategy game, inspired by the supplied dark grid references. All players race from the bottom of an 11 × 11 board to any square on the gold top edge. Two to four players can play against the computer or share one device.

## Play

Each turn, move your pawn one orthogonal square or spend one of eight two-edge barricades. Tap a neighbouring square to move. To place a wall, choose horizontal or vertical, tap the top-left square of a 2 × 2 area, inspect the preview and confirm. Walls cannot overlap, cross, or cut off any player's route. Jump over adjacent pawns, or diagonally around them if a straight jump is unavailable. First to the gold edge wins.

This is a screenshot-inspired ruleset: all pawns share the top goal, rather than racing to opposite edges. Online multiplayer and accounts are not part of this version.

Matches and preferences save locally. Invalid saved data is rejected safely. Computer turns pause while the app is in the background or a match is paused. The original supplied logo is used unchanged for app icon, adaptive icon, splash and favicon.

## Development

Use Node 22.18+ (or Node 24).

```sh
npm install
npm start
npm run verify
npm run export:android
```

`npm test` runs the actual game engine directly with Node's TypeScript stripping, including complete computer matches and path-preservation checks.

## GitHub delivery

The repository secret **EXPO_TOKEN** must have access to the intended Expo account. On the first main push, Actions resolves and saves the dependency lockfile, links (or creates) the Expo project for this slug using that token, validates TypeScript and Android export, compiles the APK on GitHub and attaches it to a testing release. It records the real Expo project ID in app.json; no placeholder project IDs are shipped.

After the first build, compatible changes on main publish Android OTA updates to **production-1.0.1** and **preview-1.0.1** after checks pass. The GitHub-built APK uses the production channel. A preview EAS build uses the preview channel. Use the workflow's **build** action or a commit containing **[build-apk]** for a new binary. Pull requests only run checks; they cannot publish or use the Expo token.

**runtimeVersion is always the literal string `1.0.1`**, independent of app version or Android build number. A native baseline blocks OTA publication when the Expo config or dependencies change: compile a replacement binary first. If an incompatible native change is introduced later, isolate its replacement build onto a new channel before publishing updates; do not send incompatible JS to older binaries sharing runtime 1.0.1. Cosmetic JS and asset changes can ship over OTA. The first APK is required before OTA can reach a phone; Expo Go does not test the installed app's OTA path.

GitHub APKs are intended for testing and use the native template's debug signing key, matching the direct GitHub compilation workflow. Configure private release signing before Play Store distribution. EAS preview/production profiles are provided for future signed EAS builds; initial signing credentials must be configured in Expo before non-interactive EAS builds.

## Test on a phone

1. Open the latest successful [GitHub Release](https://github.com/thulanesigasa/emo-barricade/releases) and install the APK.
2. Try 2–4 players in computer and pass & play modes. Place horizontal and vertical walls, test rejected placements, and reach the gold edge.
3. Close/reopen the app mid-game; continue the saved match. Try airplane mode.
4. After a compatible update, connect to the internet, open Settings → Check for updates, and restart when prompted.

The initial delivery job may take several minutes. A failed job means the APK/OTA is not delivered; inspect its logs before retrying.
