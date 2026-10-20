# Bookez TestFlight release

Before archiving from Xcode, synchronize the generated iOS project:

```sh
npm run prepare:ios
npm run test:ios-native
npx tsc --noEmit
```

Open `ios/Bookez.xcworkspace`, select a new build number, then archive. Run
`prepare:ios` after pulling updates that change native dependencies or Expo
plugins. It applies the current Expo configuration and installs CocoaPods while
preserving local Xcode settings. Xcode now checks the installed Expo pods and
module registrations against the JavaScript dependencies before compiling.

Build 4's archived binary omitted `ExpoCrypto`, `ExpoWebBrowser`,
`ExpoAppleAuthentication`, and `ExpoSplashScreen`. The new JavaScript imported
Crypto and WebBrowser during startup, causing a native-module error before the
first screen could render. JavaScript export and TypeScript checks alone cannot
detect this mismatch. This repair requires a new native build uploaded to
TestFlight; the existing build cannot acquire the missing libraries. Verify a
Release build on an iPhone, including updating over the previous installation,
before submitting. Keep the previous installation's data during this check.

Repair validation: TypeScript, the native-dependency regression checks, iOS
JavaScript export, and the Xcode Release simulator build passed. The compiled
app reached the sign-in screen on an iPhone 17 Pro / iOS 26.5 simulator with no
fatal JavaScript or missing-module startup errors. A TestFlight upload and an
upgrade check on a physical iPhone are still required.

The repository now includes `eas.json` with development, preview, and production
profiles. Before the first cloud build, complete these one-time account steps:

1. Sign in to EAS with the Expo account that owns project ID
   `0f1366e7-a5a2-4e72-94a1-516e015dc07a`.
2. In the Expo dashboard, add these variables to the **production** environment:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SENTRY_AUTH_TOKEN` (optional, for Sentry source-map uploads)
3. Create an App Store Connect app whose bundle ID is
   `com.lecoffeeconfit.bookme`.
4. Add the App Store privacy policy URL, support URL, app description, screenshots,
   age rating, and privacy answers in App Store Connect. The in-app legal copy is
   already available from Profile, but Apple still requires a public policy URL.
5. In the Supabase Auth dashboard, set a **10-character minimum password** and
   require lowercase, uppercase, and numeric characters. The same policy is in
   `supabase/config.toml`, but do not use a broad config push without reviewing
   any existing hosted Auth settings first.
6. Before each release, run the ephemeral RLS check with a Supabase
   `SUPABASE_SECRET_KEY` supplied through your CI secret store:
   `npm run verify:bookez-rls:ephemeral`. It creates two auto-confirmed test
   users, verifies owner isolation and Community block protection, then deletes
   both users and their temporary data. Never place that secret key in
   `.env.local` or commit it.
7. Start the build and let EAS prompt for Apple Developer credentials and signing:

```sh
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile production
```

After the build finishes, submit the selected IPA to TestFlight:

```sh
npx eas-cli@latest submit --platform ios --profile production
```

The submit profile is intentionally empty so App Store Connect values are not
committed to source control; EAS will ask for them interactively. The production
profile auto-increments the iOS build number for each new build.
