# Online rooms

The frontend runs on GitHub Pages. Supabase Auth identifies anonymous players; the `game` Edge Function runs the same bundled TypeScript engine as local play. Only server credentials can update canonical state. PostgreSQL commits a snapshot, accepted command, random outcomes and events atomically. Private Realtime messages contain room ID/version only; each browser fetches its own redacted view.

## Local backend (Docker required)

1. Install dependencies with `npm install` and install the Supabase CLI.
2. Run `supabase start`, then `supabase db reset` from the repository root. The checked-in migration creates tables, restricted RPCs and private channel policy; `supabase/schema.sql` is the identical SQL for dashboard setup.
3. Run `npm run backend:bundle`, then `supabase functions serve game`. Re-run the bundle after engine changes. The bundle is generated and intentionally untracked.
4. Obtain local URL and publishable/anon key from `supabase status`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, then run `npm run dev`.
5. For real integration tests set `SUPABASE_TEST_URL` and `SUPABASE_TEST_PUBLISHABLE_KEY` in the process environment; run `npm run test:backend`. Tests create three anonymous identities and persistent test rooms. Use a disposable local backend and reset it after testing.

The test suite explicitly skips network integration when these variables are absent. A green skipped run does **not** verify multiplayer. The test performs real HTTP, Auth, database-permission, concurrent command, private Broadcast, reconnect and hidden-selection checks, then finishes all four races through each player's projected legal actions. Full-game requests are paced below the production per-user rate limit.

## Hosted setup

1. Create a Supabase project. Enable anonymous sign-ins in Authentication settings. Supabase's Auth endpoint rate limits apply in addition to this project's per-user limits (120 authenticated requests/minute and 12 create attempts/hour).
2. Link the project with `supabase link --project-ref YOUR_PROJECT_REF`; apply migrations with `supabase db push` (or run `supabase/schema.sql` once in SQL Editor).
3. In Realtime settings disable **Allow public access**. Clients subscribe to private `room:<uuid>` channels; no client Broadcast insert policy is granted.
4. Run `npm run backend:bundle` and `supabase functions deploy game`. `verify_jwt=false` is intentional: the function itself requires and verifies every bearer token with `auth.getUser`, including projects with asymmetric signing keys. A missing or invalid token returns 401 before data access.
5. Set the public project URL and publishable key in the Pages build environment. Older projects may use the anonymous public key via `VITE_SUPABASE_ANON_KEY`. Never place service-role/secret keys in Vite variables, GitHub public files, or browser storage.
6. Run the real integration suite against a staging project before publishing. Verify with two separate browser profiles, not two tabs sharing one identity.

The Edge runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service key is backend-only. Browser values are intentionally public; RLS, RPC grants, authenticated membership and the authoritative reducer enforce access. Rooms are invited by six-character code and admit players only before start. No room list is exposed. Nicknames are display labels, not identities.

## CI gate

On an Ubuntu runner with Docker, install Supabase CLI and dependencies, then run `npm run test:backend:ci`. The runner starts/resets Supabase, bundles the engine, serves the Edge Function and supplies mandatory test credentials. After the API suite completes a four-race game, it installs Chromium and runs `playwright.online.config.ts` against Vite configured for that same backend. Two isolated browser contexts create/join/ready/start, check secret-selection payloads, reveal and reload/reconnect. The dedicated browser configuration rejects missing credentials instead of skipping. Cleanup stops Supabase in a finally block. No hosted credentials are needed for this job.

## Reconnect and privacy

The SDK persists its anonymous session on the same browser. Reloading or rejoining returns the existing seat. Two tabs share that seat; every accepted action is idempotent by UUID and stale commands return 409. Network/5xx retries reuse the same command UUID. The UI refetches after private invalidation, reconnect, focus, and every 15 seconds while visible. The server waits for disconnected decision owners; it never invents their strategic choice.

Clearing site data, signing out, or moving to another device loses an anonymous identity. Cross-device account recovery and replacing a disconnected player midgame are not implemented. Save browser data until a game finishes.

Secret choices and future random/deck state are projected out on the server. A private channel does not make shared payloads player-private, so only version hints are broadcast. JWT subscription permission can remain cached, but state reads and commands recheck membership. No private snapshots enter browser Data API tables or shared broadcasts.

Local pass-and-play remains fully available without any Supabase configuration. No backend provisioning or live verification is implied by a successful frontend build.
