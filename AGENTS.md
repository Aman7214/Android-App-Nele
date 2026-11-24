This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Skills (always on — do not ask the user to name them)

Load the matching skill with the `skill` tool **before** writing code, then follow it. No need to ask permission; no need for the user to remember IDs.

| Task | Load |
| --- | --- |
| Screens, navigation, app structure, native modules, offline | `frontend-mobile-development-react-native-architecture` |
| RN styling, Reanimated, navigation visuals | `ui-design-react-native-design` |
| Global state / server state (Zustand, Jotai, React Query) | `frontend-mobile-development-react-state-management` |
| Types, generics, API models | `javascript-typescript-typescript-advanced-types` |
| Tests, TDD, test setup | `javascript-typescript-javascript-testing-patterns` |
| Design tokens, theming, component library | `ui-design-design-system-patterns` |
| Animations, transitions, loading/feedback states | `ui-design-interaction-design` |
| A11y audit, screen readers, WCAG | `ui-design-accessibility-compliance` |
| Colour, spacing, typography, visual hierarchy | `ui-design-visual-design-foundations` |
| Web target (app runs in browser) | `frontend-mobile-development-nextjs-app-router-patterns` |
| Backend/API service | `javascript-typescript-nodejs-backend-patterns` |

Rules: load every skill whose row applies (usually 2–3 per task), skip ones that do not; never load the native-Kotlin skills (`android-development`, `mobile-android-design`, `ui-design-mobile-android-design`) for this Expo project; and mention in one line which skills were applied so the user can see the policy working.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
