# Bookez Google sign-in

Bookez uses Supabase browser OAuth with PKCE. The native application ID remains
`com.lecoffeeconfit.bookme`; its return link is `bookez://auth/callback`.
Google redirects to Supabase first, then Supabase returns to the app. Google
must allow the HTTPS Supabase callback, not the app's custom scheme.

## Verified live configuration (2026-10-19)

- Supabase project: `cedyrwcnyoytrnjgjxus` (CityPeak, shared backend).
- Google provider: enabled.
- Active Google client:
  `781735979126-6s34j8kguvqebgek4ksr66e9toocc6mv.apps.googleusercontent.com`
  in Google Cloud project `wordwiz-500802`.
- Required authorized redirect URI:
  `https://cedyrwcnyoytrnjgjxus.supabase.co/auth/v1/callback`.
- Added and saved the required callback on the active Google client. The
  existing WordWiz callback remains registered.
- Verified the live authorization request reaches Google sign-in without
  `redirect_uri_mismatch` or `invalid_client`. Full account sign-in and the
  native return still require device validation.
- The separate BookMe project (`bookme-511023`) has a different OAuth client;
  changing that client's redirect alone will not fix the active Supabase flow.

Because Supabase Auth is shared, changing its Google client ID/secret can affect
other applications. Fix the callback on the currently configured client instead
of replacing shared credentials as part of this repair.

## App behavior

Native sign-in opens the system authentication browser. The browser result and
app link listener share a single PKCE exchange for duplicate callback delivery.
Provider errors are surfaced instead of silently falling back to an old session.
Web sign-in returns to the web application's root URL, which must be included in
Supabase Auth's redirect allow list for each deployed web origin. Never use the
email-confirmation website as the web OAuth callback unless it implements the
same PKCE session exchange and storage.

## Verification

Run `node scripts/test-bookez-auth.mjs`, `npm run test:security`, and
`npx tsc --noEmit`. After saving the console change and allowing propagation,
verify that the Supabase authorization URL reaches Google's account chooser
without `redirect_uri_mismatch`. Then complete Google sign-in on a native build,
confirm the app returns signed in, restart it to check persistence, and test
cancellation. A real account sign-in is required to verify the token exchange and
profile creation end to end; an account chooser alone does not prove those steps.

References: https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/
and https://supabase.com/docs/guides/auth/social-login/auth-google
