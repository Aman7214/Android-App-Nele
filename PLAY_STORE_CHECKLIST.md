# Play Store release checklist

What is already done in this repo, and what still has to be done by hand in the
Play Console. Last reviewed 18 November 2026.

## Already handled in code

| Requirement | Where |
| --- | --- |
| Application ID (`com.nele.raichur`) | `app.json` → `expo.android.package` |
| Version code for uploads | `app.json` → `expo.android.versionCode` (bump every upload) |
| Version name | `app.json` → `expo.version` |
| Adaptive icon, monochrome icon | `app.json` → `expo.android.adaptiveIcon` |
| Terms of use screen | `src/app/legal/terms.tsx` |
| Privacy policy screen | `src/app/legal/privacy.tsx` |
| Help centre + FAQ | `src/app/help.tsx` |
| Booking-agent callback form | `src/app/agent.tsx` → `POST /agent-requests` |
| Payments & payouts visibly locked | `src/app/(tabs)/profile.tsx` (`Payments & payouts` → "Coming soon") |
| In-app account deletion | Profile → Delete my account → `DELETE /account` |
| Public privacy URL | `public/legal/privacy.html` in the `legal` bucket |
| Public terms URL | `public/legal/terms.html` in the `legal` bucket |
| Public account-deletion URL | `public/legal/delete-account.html` in the `legal` bucket |

Publish the legal pages with:

```bash
neon deploy --env .env.local                                   # creates the `legal` bucket once
node --env-file=.env.local scripts/upload-legal-pages.mjs      # uploads and prints the URLs
```

## Target API level

Google Play requires new apps and updates to target **Android 16 (API 36)** from
31 August 2026 ([policy](https://developer.android.com/google/play/requirements/target-sdk)).
React Native 0.88, which Expo SDK 58 builds on, declares `targetSdkVersion="36"`
in its Android manifest, so this project meets the requirement. Confirm it in the
generated manifest after the first `eas build`.

## Data safety form — answer from what the code actually does

| Question | Answer |
| --- | --- |
| Does your app collect or share user data? | Yes — collected, not shared with third parties for their own use |
| Data types collected | Personal info: name, email, phone (only in agent requests), address (town/locality). Photos and videos: listing photos. Files and docs: optional ownership/tax/ID documents. Messages: in-app chat. |
| Is data encrypted in transit? | Yes — HTTPS end to end |
| Can users request data deletion? | Yes — in-app Profile → Delete my account, plus the public delete-account URL |
| Is data shared with third parties? | No. Neon is a service provider (processor) hosting database, auth, storage and functions |
| Advertising or marketing | None |
| Analytics | None — no analytics SDK is bundled |
| Is data used to track users across apps/sites? | No |
| Ephemeral processing | Photos/documents are stored, not ephemeral |

## Permissions — verified from the merged manifest

Run this to check the resolved permissions yourself:

```bash
npx expo config --type introspect --json > /tmp/introspect.json
```

| Permission | Why | How it gets into the build |
| --- | --- | --- |
| `android.permission.CAMERA` | Photograph a property while listing, and photograph a document | Declared in `expo-image-picker`'s own `AndroidManifest.xml`, merged in by Gradle. It is **not** in the app-level config list, so `expo config` without `--type introspect` will not show it. |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | Resolve the user's nearest service town, on the district screen and via "Near me" in Explore. Skippable — every town is also selectable by hand. | `expo-location` plugin (`locationWhenInUsePermission`) |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | Pick an existing photo or document to attach | From `expo-image-picker` / `expo-document-picker`, capped at `maxSdkVersion="32"` |
| `INTERNET`, `VIBRATE`, `SYSTEM_ALERT_WINDOW` | React Native / Expo defaults (the last is debug-only tooling) | Base manifest |
| `RECORD_AUDIO` | **Not requested.** The plugin emits it with `tools:node="remove"`, so it is stripped from the final manifest even though it appears in the introspect list. | `expo-image-picker` → `microphonePermission: false` |

No background location, no contacts, no SMS, no `QUERY_ALL_PACKAGES`.

Camera hardware is **optional** on purpose: the app never declares
`<uses-feature android:name="android.hardware.camera" android:required="true">`,
so a device without a camera can still browse and pick photos. Keep it that way
unless the camera becomes mandatory — that flag would shrink your device reach.

## Account deletion (Play requirement)

Play requires *both* an in-app path and a web resource
([policy](https://support.google.com/googleplay/android-developer/answer/13327111)).
Both exist:

1. In app: Profile → **Delete my account** → confirm. Calls `DELETE /account`,
   which deletes the user's objects from object storage and then the account row,
   cascading listings, photos, documents, conversations, messages, saved rows and
   agent requests.
2. On the web: the `delete-account.html` URL printed by the upload script. Enter
   it in Play Console → *App content → Data deletion → Delete account URL*.

## Still to do by hand

- [ ] Replace `support@nele.app` with a mailbox you actually monitor (appears in
      Terms, Privacy, the help centre and the delete-account page).
- [ ] Point `nele.app` (or whichever domain you own) at the bucket URLs with a
      Cloudflare/CNAME in front, so Play links can survive a branch change. The
      raw bucket URLs are branch-scoped.
- [ ] Create the upload keystore and back it up (`eas credentials`). Losing it
      blocks all future updates unless Play App Signing is enabled.
- [ ] `eas build --platform android --profile production` with a `development`,
      `preview` and `production` profile in `eas.json` (not yet committed).
- [ ] Content rating questionnaire (property marketplace, no user-to-user
      gambling, user-generated content **yes** — listings and chat).
- [ ] Store listing: title, short description, full description, 2–8 phone
      screenshots (Explore, property detail with photos, chat, listing form),
      feature graphic 1024×500, app icon 512×512.
- [ ] Target audience: 18+ only, since the app is for property transactions.
- [ ] If chat stays live at scale, add a block/report flow before launch — Play
      expects user-generated content moderation for apps with messaging.
- [ ] Privacy policy must stay in sync with the in-app text if either changes.

## Known gaps before submitting

- No block/report for chat (see above).
- No "report listing" action for buyers.
- Chat polls every 4 seconds rather than pushing; fine functionally, but see the
  "messages seem delayed" FAQ entry in `src/app/help.tsx`.
