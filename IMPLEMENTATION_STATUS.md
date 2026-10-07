# Implementation status — 2026-09-26

**Local release candidate implemented and tested. Overall Definition of Done remains open:** real Supabase integration, hosted multiplayer and live deployment require external access. Do not label this a deployed/fully accepted online release.

## Delivered and reviewed

| Area | State | Evidence |
|---|---|---|
| Product/rules audit | Complete against supplied pack | All eight original files read; 36 unique racer IDs; supplied latest erratum retained |
| Project control system | Maintained | All five requested control documents |
| Pure authoritative engine | Implemented, locally verified | Typed commands, resumable frames, replay, phases, movement/warp/pass, track priority, scoring |
| All 36 racer mechanics | Directly tested | 36 named behavior tests, catalogue consistency and 36 elimination/deactivation tests |
| Critical interactions | Regression-tested | Reroll provenance; Copy Cat atomic action; original-copy priority; Baba Yaga retained trip; group passing; finish ordering; copied setup; loop vs progress |
| Full game variants | Verified simulations | 2–6 players, three-player double mode, four races, draft, used racers and ledger |
| Local UI | Browser-tested | Private handoff, ordered selection, IndexedDB, original generated artwork, responsive board, causal log and choices |
| Supabase authority | Implemented, not live-verified | JWT, membership actor, service-only RPCs, CAS/idempotency, private views and version-only Broadcast |
| Real multiplayer tests | Externally blocked here | Six API tests including full game; dedicated two-browser journey; mandatory Docker CI job |
| Deployment preparation | Implemented | Relative assets, production subpath tests, Pages gated on application/backend CI, setup docs |
| Hosted deployment | Not performed | No remote; GitHub login invalid; no Supabase credentials |
| Board/source verification | Limited | Supplied map reconstructed; BGG returned 403; product imagery did not establish all coordinates |

## Executed verification

- Clean `npm ci --cache .npm-cache` succeeded; dependency audit: **0 vulnerabilities**.
- `npm run typecheck` and `npm run lint`: passed.
- `npm test`: **130 passed, 6 real-backend tests skipped** without service configuration. Includes 250 generated property cases.
- `npm run build`: passed; app, React, validation and online chunks in `dist/`. Upstream Zod annotation warnings are non-failing.
- `npm run backend:bundle`: passed, generated from the same engine source as the browser.
- `npm run test:e2e`: **60 browser scenarios validated** across Chromium, Firefox, WebKit, tablet and mobile, including complete games and reload. The latest full run passed 59; its remaining WebKit assertion was corrected to wait for React rendering after the paused clock advances, then passed in a focused rerun.
- `npm run test:production`: **2 passed** at `/magical-athlete/`; assets, query, local race, reload, mobile overflow, page/console errors and failed requests checked.
- Production desktop/mobile screenshots visually reviewed; artifacts are ignored under `test-results/`.

Windows sandbox blocked esbuild ancestor traversal; affected commands ran in the approved broader filesystem context. Cache/browser downloads stayed inside this workspace. Ordinary local setup needs no sandbox workaround.

## External acceptance gates

1. **Real backend:** Docker CLI/Desktop and Supabase project settings are absent here. Run `npm run test:backend:ci` on a Docker-enabled host or in committed GitHub CI. It provisions a real stack and runs API plus two-browser tests; missing configuration must fail.
2. **GitHub:** restore the CLI login with `gh auth login -h github.com`. The principal can then create/configure a remote, push, run CI and publish. No live CI/deployment result is claimed.
3. **Hosted Supabase:** project access is needed for migration, anonymous Auth/private channels, Edge deployment and hosted room checks. See README_BACKEND.md.
4. **Source confidence:** verify ten Wild Wilds positions and the corner threshold against a clear official board/owner copy before claiming independent map verification.

No known failing local regression remains at this checkpoint. This is not exhaustive proof of every possible multi-power combination. Explicit interpretations remain in RULES_ASSUMPTIONS.md.

## Next autonomous step

### U-shaped board and dice presentation — 2026-09-26

- Replaced the serpentine matrix with the supplied image's U silhouette; labeled first corner 12 and second corner 15. Narrow screens retain the U with contained horizontal scrolling.
- Replaced the turn button copy with Roll die / 擲骰子. Added a pip die, rolling phase, actual result reveal and persistent last-result label. Visible movement waits for the reveal; saved canonical state remains immediate. Rerolls use new recorded events, while Keep and non-dice actions invent no roll.
- Fast mode/reduced motion skip tumbling. Reload displays the last result without replaying historical events. Pre-race roll-offs do not delay private setup handoffs.
- Added four browser scenarios across five projects for geometry and presentation ordering. All 60 browser cases validated (59 in the final full run, then the repaired WebKit timing assertion passed separately). Typecheck, lint, 130 unit tests, build and two production-subpath checks passed. The six real-backend checks still require the existing external environment.

### Visual and Traditional Chinese update — 2026-09-26

- Added persistent English / Traditional Chinese selection; Traditional Chinese is the default for new browsers. All 36 racer names, power summaries, current decision prompts and normal event messages have display translations. Original English identities remain available; no engine state or replay strings are translated.
- Generated and integrated an original illustrated board background. Updated paper cards, board tiles and narrow-screen hero layout. The generated asset is stored in `apps/web/public/art/race-world.webp`; source prompt and tool provenance are in `ART_DIRECTION.md`.
- All 36 original character portraits generated successfully as six sprite sheets after retrying initial network failures. Integrated into the home page, guide, cards, roster and tokens. All art is optimized WebP; no placeholders remain.
- Localization browser checks: 15 passed across five projects, including 360px layout, language persistence, keyboard focus and ordered selections/save/reload. Four additional localization unit tests passed (130 total); final artwork and localization checks passed in all five browser projects (20 checks), including 36 unique/decodable portraits and bilingual label containment. Production-subpath desktop/mobile checks passed with image request failures checked.


When access is available, run the real-backend gate, fix integration failures, deploy matching backend/frontend, perform hosted multi-browser/reconnect/privacy checks and update this record before closing the Definition of Done. The owner has no routine architecture or agent-coordination task.

## Immersive playback delivered — 2026-10-07

- Added sequential per-space forward/backward playback, direct warp/swap effects, simultaneous group/follower arrival, horizontal mobile follow and role/power spotlights with original portraits and bilingual explanations.
- Added seven locally synthesized sound cues, opt-in sound, persistent volume/mute, gesture unlock, bounded voices and safe handling of unavailable audio. Fast/reduced-motion and per-action Skip reveal current canonical state immediately.
- Runtime changes are structured movement event metadata only; no racer mechanics or track coordinates changed. Canonical persistence and network resolution remain immediate. Independent review identified and resolved the second participant's swap styling.
- Verification: typecheck/lint/build and backend shared-engine bundle passed. Full browser run: 65/65 passed across Chromium, Firefox, WebKit, tablet and mobile, including four-race completion. Production-subpath desktop/mobile: 2/2 passed. Desktop/mobile power-playback screenshots visually reviewed under ignored output/screenshots/.
- Final full unit regression: 139 passed; 6 environment-dependent backend checks skipped. Includes unequal-distance simultaneous arrival and withholding dice results from the log during tumbling.
- External hosted multiplayer/deployment gates above remain outside this presentation change; no hosted verification is claimed.
