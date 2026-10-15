# Bookez admin center

The private entry lives on **Profile**, below Privacy & terms and near Account &
data. It appears only when the signed-in account passes `bookez.is_my_admin()`.
There is no separate Settings page, secret tap gesture, email hardcode,
development bypass, or client-writable admin flag.

The structure follows WordWiz’s admin center: Overview / Feedback tabs,
Today / 7 days / 30 days / All time, product signals, activity leaders, a
searchable paginated directory, moderated Community reports, and support replies.
Colors, typography, and metrics are adapted to Bookez.

## Activate after reviewing the migration

These changes are local until the migration and Edge Function are deployed.
No admin account is granted automatically.

1. Verify connectivity and the exact Bookez Supabase target. Do not bulk-push
   unrelated pending migrations into the shared database.
2. Ensure the existing Bookez schema, Community migrations, and
   `20261011150000_bookez_ai_credits.sql` are installed. Apply
   `20261012160000_bookez_admin_center.sql` after review.
3. Deploy `bookez-admin` with JWT verification enabled. It uses Supabase’s
   server-managed URL and service-role/secret key; never add a service key to
   Expo public environment variables.
4. Grant a chosen account in the SQL Editor, replacing the placeholder:

   ```sql
   insert into bookez.app_admins (user_id)
   select id from auth.users
   where lower(email) = lower('your-admin-email@example.com')
   on conflict (user_id) do nothing;
   ```

   Check that the account exists and exactly one intended identity is selected.
   Return to Profile or reopen the app to refresh membership. To revoke access:

   ```sql
   delete from bookez.app_admins
   where user_id = (
     select id from auth.users
     where lower(email) = lower('your-admin-email@example.com')
   );
   ```

5. Test both the admin and an ordinary account. Confirm that ordinary accounts
   see no entry and receive 403 from the protected Edge Function even if they
   change client code or forge `user_metadata`.

## Scope and privacy

- Directory membership is limited to `bookez.profiles`, not every account in
  the shared Auth project. Admin membership is separate from WordWiz roles.
- Metrics use cloud project word counts and completed writing sessions. Private
  chapter text, manuscript snapshots, notes, and research are not queried.
  Local-only activity is not visible. No new screen-time tracking was added.
- Activity metrics follow the selected range; library totals, report/support
  queues, and per-writer AI balances are current. Today begins at midnight UTC.
- AI refills offset completed charges for the current UTC month. They do not
  erase the ledger, refund pending requests, change the monthly clock, or grant
  subscription access. Repeating a refill without new completed use grants no
  additional credits.
- Pause sharing unpublishes the writer’s books and closes their Community
  feedback requests. Database triggers prevent older clients from re-publishing.
  Restore removes the hold but does not re-share anything automatically. This
  is a sharing restriction, not a ban on all Community interactions.
- Removing a public picture clears the profile pointer; signed/cached pictures
  can remain visible until they expire. Uploaded-object deletion is not claimed.
- Shared Auth account deletion is deliberately absent: deleting Bookez’s shared
  identity could also delete CityPeak access. No other app’s data is changed.
- Every privileged update and its audit record commit in one database
  transaction. A timeout can still occur after the server commits; refresh and
  check the audit trail before repeating an uncertain action.

## Feedback

Profile’s Feedback & suggestions / Report a problem now write private support
tickets instead of reporting a session-only success. Offline/failed submissions
keep the message and show an error. The server caps submission rate. Users may
read only their own tickets/replies and cannot set ticket priority/status or
reply as an admin. Admin replies are available under **Profile → Feedback &
suggestions → Your recent feedback & replies**. Community reports remain a
separate moderation queue.

## Verification

```sh
npx tsc --noEmit
npm run test:admin
npm run test:security
npm run test:editor-mode
npm run test:ai-writing
npm run test:ai-credits
```

`test:admin` executes the real Edge Function with mock authentication/database
services and tests the pure admin model. It does not call a live account.

An optional PostgreSQL/WASM test executes the actual migrations, RLS policies,
triggers, and functions in isolation. Install `@electric-sql/pglite` in a separate
test directory (not as an app dependency) and provide its entrypoint:

```sh
BOOKEZ_TEST_PGLITE_MODULE=/absolute/test-directory/node_modules/@electric-sql/pglite/dist/index.js npm run test:admin-sql
```

The SQL fixture mirrors the existing tables used by the admin functions. It
checks role isolation, reporting ranges, shared-Auth isolation, safe refills,
sharing holds, user-private support, rate limits, and transactional auditing.
It is not a substitute for testing against the staged Bookez schema before
production deployment.
