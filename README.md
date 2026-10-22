# Barricade

An offline Expo / React Native strategy game, inspired by the supplied dark grid references. All players race from the bottom of an 11 × 11 board to any square on the gold top edge. Two to four players can play against the computer or share one device.

## Navigation and appearance

Home, Play and Profile use a compact floating bottom bar with three destinations and a five-tab limit. Home gives quick access to setup and a saved match. Play contains match setup and the board. Profile stores a local player name, shows the current match, and provides preferences and update checks. Switching tabs preserves the match and pauses computer responses until Play is active. Main screens use open sections rather than boxed cards. The home logo is 220 points wide and the native splash uses a 160-point image width. Changing the native splash requires a replacement APK; runtime stays 1.0.1.

CI retains a short-lived, unpublished web bundle for UI review. It does not deploy a website.

## Play

Each turn, move your pawn one orthogonal square or spend one of eight two-edge barricades. Tap a neighbouring square to move. To place a wall, choose horizontal or vertical, tap the top-left square of a 2 × 2 area, inspect the preview and confirm. Walls cannot overlap, cross, or cut off any player's route. Jump over adjacent pawns, or diagonally around them if a straight jump is unavailable. First to the gold edge wins.

This is a screenshot-inspired ruleset: all pawns share the top goal, rather than racing to opposite edges. Online multiplayer and accounts are not part of this version.

Choose Open, Crossroads, or Switchback starting layouts. Pre-placed walls leave every player a route and do not consume anyone’s eight available barricades. Suggest a move previews a legal move or wall without taking your turn. Undo restores your last full human turn including computer replies; the last 30 undo points persist with the saved match. Player cards show route distance through walls (excluding pawn occupancy). Old saves migrate automatically.

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

New commits supersede stale runs. Native generation, wrapper download and ARM APK compilation are separate bounded steps. Gradle uses its official GitHub distribution mirror, with cached dependencies and diagnostic log artifacts on failure. The APK supports ARM64 and ARMv7 phones; emulator x86 builds are not included.

The initial delivery job may take several minutes. A failed job means the APK/OTA is not delivered; inspect its logs before retrying.
