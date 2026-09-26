# Magical Athlete — private online edition

A browser game for local pass-and-play and private online rooms, based on the supplied **CMYK 2025** gameplay references, including the recorded August 2026 simultaneous-arrival correction. The original 36 racer identities and mechanics are the implementation target; the visual assets are original project artwork.

Consult [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and [RULES_COVERAGE_MATRIX.md](RULES_COVERAGE_MATRIX.md) for the current verification record. A successful build alone does not establish complete rules fidelity or a working hosted multiplayer deployment.

## Run locally

Install Node.js 24, then:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No Supabase account, Docker installation, or environment variables are needed for local play.

Choose two to six players and enter names. Draft your teams, or explicitly choose the simpler random-team option. During private choices, hand the device to the named player before revealing their controls. Two-player games use two ordered racers per player; the supported three-player double-racer option is available in setup. Complete four alternating Mild Mile/Wild Wilds races, then compare final scores. Tied leaders share victory.

Use **Take turn** and the displayed power/target decisions to play. Open **Racer guide** to read all powers. The race log explains automatic effects. Local games are saved on this browser; **Resume saved game** restores the saved game. Clearing site data removes that save. Pass-and-play privacy relies on handing over the device; it is not a security boundary against someone inspecting browser storage.

## Check the project

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps
npm run test:e2e
npm run test:production
```

Unit tests cover the engine and interaction regressions. Browser tests exercise drafting, private handover, racer information, responsive layouts, persistence and full-game play. The production bundle is written to `dist/`.

Backend integration tests use a **real** Supabase stack. On a machine with Docker and Supabase CLI installed:

```sh
npm run test:backend:ci
```

That command provisions a disposable local backend, applies SQL, bundles the shared engine, serves the authenticated endpoint, and runs real Auth/database/concurrency/Realtime/privacy tests. It fails if the backend does not start. Running ordinary `npm test` without backend variables intentionally skips network tests; that is not multiplayer verification.

Current local evidence: 126 passing unit/integration tests, 20 browser/device journeys and two production-subpath checks. Six real-backend tests and the dedicated online journey await a configured service. The supplied Wild Wilds coordinates remain provisional pending official/physical board verification.

## Online rooms

Follow [README_BACKEND.md](README_BACKEND.md) to provision Supabase, apply the schema, enable anonymous authentication, configure private Realtime and deploy the Edge Function.

Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Restart Vite after changing configuration. Create a room with a nickname, share the room link/code, and have everyone mark themselves ready. The host starts the game. Use separate browser profiles/devices for different players: tabs sharing a browser session are the same player.

Online actions are checked by the server's shared engine. Clients cannot overwrite canonical game state or choose dice results. Secret selections are projected separately for each player and revealed together. Realtime only announces a changed room version; browsers fetch their own authorized view. A disconnected decision owner keeps their turn/choice until reconnecting.

Reloading on the same browser restores the anonymous identity. Clearing browser data or changing devices does not support identity recovery. The initial release has no midgame player replacement or automatic strategic timeout choices. Missing backend configuration leaves local play usable.

## Publish with GitHub Pages

1. Push the project, including `package-lock.json`, to a GitHub repository on `main` or `master`.
2. In repository **Settings → Pages**, select **GitHub Actions** as the source.
3. For online play, provision/deploy the backend from the same source revision first. Add repository Actions **variables** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Leave both absent for a local-only site. Never add privileged backend credentials to frontend variables.
4. Push or manually run **Deploy GitHub Pages**. Its reusable verification workflow must pass unit/build/browser checks **and real Docker-backed multiplayer tests** before an artifact can deploy.
5. Open the deployment URL shown in Actions. Test both local play and, when configured, a room in separate browsers before inviting friends.

Vite uses relative asset paths, so GitHub user sites and repository subpaths both work. Room invitations use a query parameter on the existing page rather than requiring server-side route rewrites. Frontend deployment does not deploy or migrate the external backend; follow its setup instructions when changing engine/backend code.

The page has `noindex,nofollow` metadata and `robots.txt` discourages indexing. **These are not authentication.** The site can be public, and anyone holding a room invitation can attempt to join its lobby.

## Project map

- `packages/engine/`: pure game state, commands, ordered rule resolution, racer powers and tests.
- `apps/web/`: React interface, original artwork, local persistence and online transport.
- `supabase/`: restricted persistence, authoritative endpoint and deployment helpers.
- `PROJECT_PLAN.md`, `ARCHITECTURE.md`: implementation control plan and architecture.
- `RULES_ASSUMPTIONS.md`: recorded interpretations; supplied reference/JSON files remain the gameplay source of truth.

No official scans, proprietary fonts, or commercial artwork are bundled. This project is an unofficial implementation for private play.
