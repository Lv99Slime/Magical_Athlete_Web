# Codex Master Prompt — Magical Athlete (2025) Private Online Edition

## Your role
You are the lead game engineer, gameplay-systems programmer, UI/UX designer, QA engineer, and deployment engineer for this project.

Your task is to build a complete browser-based implementation of **Magical Athlete (CMYK 2025 edition)** for private play among the repository owner's friends.

The game must preserve the **original 2025 racer names, power names, mechanical effects, race structure, drafting system, scoring system, track rules, timing rules, and interaction rules**. The accompanying project reference files are the source of truth for implementation. The wording of card text in the UI should use the supplied paraphrased descriptions rather than copying long passages from the commercial rulebook.

Use the **latest base-game rules interpretation supplied in this project**, including the August 17, 2026 official rulebook update that changes simultaneous-arrival timing. Do not revert to an older printed-rule interaction when the project reference explicitly marks it as superseded.

---

# 1. Product goal

Build a polished online board-game experience that a user can deploy to GitHub Pages and share by URL.

Target experience:

1. A player opens the GitHub Pages URL.
2. They can choose:
   - **Local Pass-and-Play** — fully functional with no backend.
   - **Online Room** — create a room, share a join link/code, and play remotely with friends.
3. No account is required; players enter a nickname.
4. The game handles all rules, movement, power triggers, scoring, drafting, turn order, and edge cases automatically.
5. The UI clearly explains every automatic effect so players can understand why a racer moved, tripped, warped, scored, was eliminated, or gained an extra turn.
6. The game is usable on desktop, tablet, and mobile.

This is a private/friends project, but assume the GitHub Pages URL itself can be publicly reachable. Do not store secrets or sensitive information in the frontend.

---

# 2. Required technology

Use a maintainable modern frontend stack:

- Vite
- React
- TypeScript with strict mode
- CSS modules, plain CSS, or a lightweight styling solution
- Vitest for unit tests
- Playwright for critical end-to-end tests if practical

State architecture:

- The core game engine must be **pure TypeScript**, independent from React.
- UI components must call the engine through typed actions/selectors.
- Do not put racer-specific logic inside React components.
- Do not implement the 36 racers as a huge UI `if/else` chain.

Recommended folders:

```text
src/
  game/
    engine/
    events/
    rules/
    racers/
    tracks/
    tests/
    types.ts
  ui/
    components/
    screens/
    hooks/
  multiplayer/
  data/
  assets/
```

---

# 3. GitHub Pages deployment

The repository must deploy successfully using GitHub Actions.

Requirements:

- Include `.github/workflows/deploy-pages.yml`.
- Configure Vite so assets work on both user sites and project sites. Prefer a relative base (`./`) unless a better robust solution is implemented.
- Include `.nojekyll` if needed.
- `npm run build` must produce a deployable static bundle.
- The README must explain exactly how to enable GitHub Pages.
- Add `robots.txt` with `Disallow: /` and add `noindex,nofollow` metadata because this is intended for friend-only use. Clearly document that this is **not real access control**.

---

# 4. Multiplayer architecture

GitHub Pages is static hosting, so true remote multiplayer requires an external realtime data service.

Implement two modes.

## Mode A — Local Pass-and-Play

This is mandatory and must work with zero configuration.

- 2–6 players.
- One browser/device.
- Player names entered locally.
- All drafting, racer selection, racing, scoring, and results work end-to-end.

## Mode B — Online Room

Implement using **Supabase Realtime** and anonymous/friendly room membership unless there is a compelling technical reason to choose a similarly simple backend.

Requirements:

- No email/password registration.
- Host creates a 6-character room code.
- Shareable URL format such as `?room=ABC123`.
- Players join with a nickname.
- Waiting room shows members and ready state.
- Host starts the game when a legal number of players is present.
- The authoritative game state must be synchronized across clients.
- Reconnect using a locally stored player token.
- Never expose a Supabase service-role key in browser code.
- Supply `.env.example` for public client configuration.
- Supply SQL/RLS setup in `supabase/schema.sql`.
- If Supabase variables are missing, the app must still start and Local Pass-and-Play must remain fully usable.

Prefer an action-log / reducer architecture:

```text
client intention
  -> validate action
  -> authoritative state reducer
  -> persisted game action / snapshot
  -> broadcast updated state
  -> all clients render same state
```

Design the network layer so the game engine remains deterministic and testable without Supabase.

---

# 5. Source-of-truth project files

Read these before coding:

1. `MAGICAL_ATHLETE_2025_REFERENCE.md`
2. `magical_athlete_2025_racers.json`
3. `magical_athlete_2025_tracks.json`

Treat them as the gameplay specification.

If implementation details conflict:

1. Latest errata in `MAGICAL_ATHLETE_2025_REFERENCE.md`
2. Racer-specific notes in `magical_athlete_2025_racers.json`
3. General base-game rule
4. Your own reasonable implementation assumption

For any unresolved ambiguity, do not silently invent a rule. Record the decision in `RULES_ASSUMPTIONS.md`, implement the most conservative interpretation, and write a test around it.

---

# 6. Required game flow

Implement the full four-race game.

## 6.1 Lobby

- Choose 2–6 players.
- Enter nicknames.
- Pick local or online mode.

## 6.2 Draft

For 3–6 players:

- Reveal racers equal to 2 × player count.
- Determine first drafter by roll-off.
- Snake draft until every player receives two racers.
- Run a second snake draft with a fresh set of 2 × player count racers.
- The second draft begins with the player to the left of the original draft starter.
- Every player ends with exactly four racers.

For two players:

- Implement the official two-player variant from the reference file.
- Each player ultimately has eight racers and races with two racers per race.

Optional quality-of-life option:

- “Random Teams” for new players. Deal four racers each for 3–6 players. This must be explicitly labeled as the rulebook's simpler alternative, not the default draft.

## 6.3 Race selection

- Before each race, players secretly choose an unused racer.
- Reveal selections simultaneously.
- Each racer may be used only once during the game.
- Two-player / double-racer variants choose the required number simultaneously.

## 6.4 Track order

Default four-race schedule:

1. Mild Mile
2. Wild Wilds
3. Mild Mile
4. Wild Wilds

## 6.5 Starting player

- Race 1: roll-off.
- Later races: starting player is the owner of the racer that was farthest behind at the end of the previous race, or first eliminated where applicable.
- Handle ties through a roll-off if the reference rules require a tie resolution and no more specific rule is supplied.

## 6.6 Race end

- First racer to cross the finish takes first place.
- Race normally ends immediately when a second racer crosses and takes second place.
- Racer powers may change this, especially Mastermind and M.O.U.T.H.
- Finished or eliminated racers leave active play and their powers become inactive unless a rule explicitly says otherwise.

## 6.7 Scoring

Default race awards:

| Race | 1st | 2nd |
|---|---:|---:|
| 1 | 3 | 1 |
| 2 | 4 | 2 |
| 3 | 4 | 2 |
| 4 | 5 | 3 |

Bronze/star/power points are added immediately when gained.

After race 4, total all points. Highest total wins. Ties are shared victories.

---

# 7. Core rules the engine must model explicitly

Do not reduce everything to a generic position change. These concepts are mechanically distinct.

## `MAIN_MOVE`
The normal turn action of rolling a die and moving by the resulting movement amount, unless replaced or skipped.

## `MOVE`
A position-changing action explicitly treated as movement. It can cause passing, track effects, and movement-related powers.

## `WARP`
A direct position relocation. It is **not movement**, does not count as passing, and does not trigger movement-only effects.

## `STOP`
A racer has completed a movement/warp/placement and is now settled on a space. Stop-based powers are checked here, subject to simultaneous-arrival rules.

## `PASS`
For a single move: the mover began behind another racer and ended ahead of that racer. Passing is evaluated across the complete move, not by transient occupation of intermediate spaces.

## `SHARING_SPACE`
Racers are sharing a space only while both are settled on that same space. Merely passing through does not count.

## `TRIP`
Trip does not end the current move. A tripped racer skips its **next main move only**. The racer may still trigger powers and move/warp from other effects.

## `REROLL`
The previous roll is treated as though it did not happen for die-result triggers. Rerolls themselves may constitute power occurrences.

## `SIMULTANEOUS_ARRIVAL`
Latest official errata: stop-on-space powers do **not** trigger merely because racers arrive at a space simultaneously.

This must be an explicit engine concept rather than a visual animation detail.

---

# 8. Trigger and event engine

Implement an event queue / resolution stack.

Minimum event vocabulary:

```text
GAME_STARTED
DRAFT_STARTED
RACER_DRAFTED
RACE_SELECTION_STARTED
RACE_STARTED
BEFORE_RACE
TURN_STARTED
BEFORE_MAIN_MOVE
MAIN_MOVE_SKIPPED
DIE_ROLLED
REROLL_REQUESTED
DIE_REROLLED
DIE_FINALIZED
BEFORE_MOVE
MOVE_STARTED
RACER_PASSED
MOVE_COMPLETED
WARP_STARTED
WARP_COMPLETED
RACER_STOPPED
RACERS_ARRIVED_SIMULTANEOUSLY
SPACE_SHARED
TRACK_SPACE_TRIGGERED
POWER_TRIGGERED
RACER_TRIPPED
RACER_RECOVERED
RACER_ELIMINATED
FINISH_CROSSED
FIRST_PLACE_AWARDED
SECOND_PLACE_AWARDED
TURN_ENDED
RACE_ENDED
POINTS_GAINED
GAME_ENDED
```

When multiple effects become eligible at the same timing point, use this priority:

1. Racetrack-space effects
2. Current player's racer power(s)
3. Other players' racer power(s), clockwise

Triggered effects created by another resolved effect are queued and resolved in deterministic order. The UI must show the chain.

Example log presentation:

```text
Roy rolled 6.
Lackey → VERY GOOD SIRE: Lackey moves 2.
Scoocher → SCOOCH SCOOCH: Scoocher moves 1.
Roy's racer now performs its main move.
```

---

# 9. Optional decisions

Whenever a power says the racer/player **may/can** do something, the engine must prompt the correct player.

Examples:

- Alchemist: use 4 instead of 1/2?
- Cheerleader: activate before main move?
- Duelist: initiate duel?
- Genius: choose a prediction before rolling?
- Flip Flop: roll normally or swap?
- Hypnotist: warp someone before main move?
- Magician: keep or reroll?
- Rocket Scientist: double movement and trip?
- Suckerfish: follow?
- Third Wheel: warp?
- Twin: copy a prior winner?

Online mode must not auto-select strategic choices unless the player disconnects and the project later implements a deliberate timeout policy. For initial release, simply wait for that player.

---

# 10. Movement-resolution requirements

Movement must be represented as a transaction with metadata, for example:

```ts
interface MoveContext {
  sourceRacerId: RacerId;
  cause: 'main' | 'power' | 'track';
  startPosition: number;
  requestedDistance: number;
  direction: 1 | -1;
  simultaneousGroupId?: string;
  abilitySourceId?: RacerId;
  rawDie?: number;
}
```

The engine should derive:

- effective distance after modifiers
- whether Stickler prevents the move
- spaces occupied and skipped by Leaptoad
- racers passed by the completed move
- final position
- finish crossing
- track-space effect
- stop/space-sharing triggers

Avoid animating one board square at a time as the source of truth. The logical move should resolve first; animation then visualizes the authoritative result.

---

# 11. Dice pipeline

Separate:

1. raw die result
2. reroll history
3. finalized die face
4. movement amount
5. movement modifiers

This distinction is essential for Gunk, Coach, Lackey, Inchworm, Skipper, Alchemist, Magician, Dicemonger, Rocket Scientist, Legs, and others.

A modifier to movement amount must not change the finalized die face.

---

# 12. Infinite-loop protection

Implement rules-aware cycle detection.

The official base rule is conceptually:

- When an actual infinite loop is formed, complete one full loop of the repeating interaction, then stop that loop.
- Repeated interactions that keep changing game state and are not a cycle may continue.
- If a loop prevents any racer from ever finishing, the race can end without awarding remaining placement points.

Do not use a crude global “maximum 20 events” cutoff as the only solution.

Create an event-chain signature that includes enough game state to distinguish progress from a true cycle, for example:

```text
ability + source + target + positions + trip states + active event lineage
```

Keep an emergency hard cap only as a defensive fallback and report it visibly as an engine error in development mode.

---

# 13. Racer implementation

All **36 base-game racers** in `magical_athlete_2025_racers.json` are mandatory before the project can be considered complete.

Do not ship with “TODO racer logic”.

Each racer should have:

- stable `id`
- official racer name
- official power name
- paraphrased UI description
- trigger(s)
- conditions
- optional/mandatory flag
- effect resolver
- edge-case tests

Prefer a common ability interface such as:

```ts
interface RacerPowerDefinition {
  racerId: RacerId;
  subscriptions: GameEventType[];
  getReactions(ctx: TriggerContext): Reaction[];
}
```

The system must support powers copied dynamically by Copy Cat, Egg, and Twin without duplicating racer code.

---

# 14. Track implementation

Use `magical_athlete_2025_tracks.json`.

Model position independently of visual geometry:

- Start = position 0
- Finish = position 30
- Spaces 1–29 are intermediate positions

Mild Mile has no special spaces.

Wild Wilds contains arrow, trip, and star spaces as specified by the track data file.

Track effects resolve before racer powers at the same timing point.

The board SVG/CSS path can curve visually, but logical positions must remain indexed.

---

# 15. Visual design

Create an **original** visual presentation inspired by the broad mood of the 2025 edition:

- playful retro psychedelic board-game energy
- simple geometric forms
- bright flat colors
- chunky black outlines
- absurd character iconography
- high legibility
- tactile board-game feel

Do **not** copy or embed official CMYK/Angela Kirkwood artwork, scans, card backgrounds, logos, or proprietary font files.

Use original SVG/CSS avatars or simple symbolic illustrations for racers. Racer identity can be conveyed by name, icon, color, and silhouette.

The game should feel lively without becoming visually confusing.

---

# 16. Required screens

At minimum:

1. Home / mode selection
2. Local player setup
3. Online create/join room
4. Lobby
5. Draft board
6. Secret racer selection
7. Race board
8. Rules/character reference drawer
9. Race results
10. Final scoreboard

Race-board layout should include:

- main racetrack
- racer tokens
- active-player banner
- current die
- Roll / Keep / Reroll / Power-action controls
- each player's racer card/power summary
- point totals
- event log / chain resolver
- statuses such as TRIPPED, FINISHED, ELIMINATED

On mobile/tablet, use collapsible panels rather than shrinking everything into unreadable cards.

---

# 17. Animation and feedback

Animations must never determine game logic.

Include:

- dice roll animation
- token travel animation
- warp animation visually distinct from movement
- trip flip/status animation
- power activation toast
- chain-reaction log
- point-gain animation
- elimination animation
- finish celebration

Provide a “Fast animations” toggle.

---

# 18. Testing requirements

Write unit tests for the core engine before polishing animation.

Mandatory test categories:

## General
- main move vs move vs warp
- pass calculation
- shared-space logic
- trip and recovery
- rerolls erase previous die-result triggers
- track-effect priority
- current-player vs clockwise reaction priority
- simultaneous-arrival erratum
- race-end timing
- scoring for all four races
- infinite-loop handling

## Racer tests
At least one direct behavior test for every racer.

Also write focused interaction tests for:

- Alchemist × Inchworm
- Coach × Legs
- Gunk × Legs
- Gunk × Lackey
- Banana passing calculation
- Baba Yaga × Hypnotist
- Baba Yaga × Duelist
- Copy Cat × changing leader
- Copy Cat × Huge Baby priority
- Dicemonger × Magician rerolls
- Duelist outside owner's turn
- Huge Baby × Party Animal
- Inchworm × Skipper
- Mastermind predicting self
- M.O.U.T.H. leaving one racer
- Leaptoad moving backward
- Party Animal simultaneous movement under 2026 erratum
- Romantic × Suckerfish under 2026 erratum (must NOT use the old combo)
- Scoocher × Gunk
- Scoocher × Leaptoad
- Scoocher × Magician
- Stickler × Duelist
- Stickler × arrows/power movement
- Suckerfish crossing finish
- Twin copying a previous winner with a before-race power
- Egg copying a racer with a before-race power

All tests must be deterministic; inject RNG rather than using `Math.random()` directly inside the engine.

---

# 19. Development order

Work in this sequence without waiting for approval after every step:

### Milestone 1 — Repository foundation
- Vite/React/TypeScript
- lint/typecheck/test scripts
- GitHub Pages workflow
- initial README

### Milestone 2 — Pure game engine
- game state
- events
- movement
- dice
- trigger ordering
- track effects
- scoring
- tests

### Milestone 3 — All 36 racers
- implement and test all powers
- interaction tests

### Milestone 4 — Complete local game
- lobby
- draft
- racer selection
- four races
- results
- local persistence

### Milestone 5 — UI polish
- responsive track
- animation
- rules drawer
- event log

### Milestone 6 — Online rooms
- Supabase schema
- realtime synchronization
- reconnect
- room code/link

### Milestone 7 — QA and deployment
- E2E smoke test
- `npm run build`
- fix GitHub Pages routing/assets
- final README instructions

Do not stop at a mockup. Continue until the game can actually be played through from setup to final scoring.

---

# 20. Required scripts

The completed project should support:

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

If Playwright is added:

```bash
npm run test:e2e
```

---

# 21. Required documentation

Create:

- `README.md`
- `ARCHITECTURE.md`
- `RULES_ASSUMPTIONS.md`
- `supabase/schema.sql`
- `.env.example`

README must contain:

- local setup
- GitHub Pages deployment
- Supabase setup for online rooms
- how to create/share a room
- privacy/public-URL warning
- controls and supported devices
- known limitations

`RULES_ASSUMPTIONS.md` should remain short. Do not use it as an excuse to leave basic rules unfinished.

---

# 22. Definition of done

The project is complete only when all of the following are true:

- Four-race game can be completed in Local Pass-and-Play.
- All 36 base racers are present.
- All 36 powers function.
- The latest simultaneous-arrival timing rule is applied.
- Mild Mile and Wild Wilds both work.
- Draft works for normal player counts.
- Two-player variant works.
- Scoring and final winner calculation work.
- Optional powers prompt the correct player.
- Event log explains automatic interactions.
- Core interaction tests pass.
- Production build succeeds.
- GitHub Pages workflow is included.
- Online-room mode is implemented when Supabase credentials are configured.
- No official artwork scans or proprietary font files are committed.
- No secret keys are committed.

At the end, run tests and the production build yourself, fix failures, and provide a concise completion report containing:

1. what was built;
2. test/build results;
3. how to run locally;
4. how to deploy to GitHub Pages;
5. how to configure online multiplayer;
6. any genuinely unresolved rules interpretation.

Start by reading every reference/data file in the repository, then inspect the existing project if one exists, and proceed with implementation.
