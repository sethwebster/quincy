# Quincy Desktop

Expo Desktop target for Quincy using [`expo-desktop`](https://github.com/shirakaba/expo-desktop).

This app is intentionally isolated from the Electrobun implementation. The current Quincy editor depends on React DOM, Electrobun RPC, Tiptap, CodeMirror, Tailwind CSS, and Bun filesystem APIs; those pieces need React Native-compatible replacements before they can move into this target.

## Commands

```sh
npm install
pod install --project-directory=macos
npm run start
npm run macos
npm run windows
```

Run `npm run start` in one terminal before `npm run macos` in another. The macOS debug app loads `index` from Expo's Metro server on port 8081; launching the native app without Metro produces `No script URL provided`.

`npm run macos` uses the generated `macos/quincy-desktop.xcworkspace` and `quincy-desktop-macOS` scheme.

`expo-desktop` support is best-effort. The upstream `expo-desktop prebuild` command currently reports that it is not yet implemented, so native directories must come from upstream generators before run commands can build native targets.

The React and React Native versions intentionally match `react-native-macos@0.81.7` and the upstream Expo Desktop demo. `npx expo install --check` warns about Expo SDK 54's mobile patch versions, but changing to those patches would violate the macOS desktop peer dependency.
