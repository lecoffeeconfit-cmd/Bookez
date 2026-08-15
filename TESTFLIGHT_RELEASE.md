# Bookez TestFlight release

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
