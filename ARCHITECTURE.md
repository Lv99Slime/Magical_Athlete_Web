# Magical Athlete architecture

## Boundaries

TypeScript rules engine is independent of React/Vite presentation. Supabase executes validated commands against persisted authoritative room state. GitHub Pages serves static assets using Vite's relative base (`./`), verified at `/magical-athlete/`. Local mode calls the same engine directly; neither animation nor browser state defines rules.

## Engine contract

`createGame(config, random)` creates state; `applyCommand(state, { actorId, action }, random)` validates and advances it; `getLegalActions(state, actorId)` supplies choices; `projectState(state, actorId)` redacts private data. Seeded randomness and command replay reproduce failures. Actions cover draft, selection, pending decisions, roll and next race. API types in `packages/engine/src/types.ts` are the shared contract.

Game state records schema/engine/rules versions, players, separate deck/discard zones, draft cursor, private selections, race instances, fixed racer turn order, current main-move context, placements/history, numeric ledger, pending decision, resolution frames, random outcomes and event lineage. Racer identity is distinct from owner identity and effective power. Score history retains per-race gains for variant starting-player rules.

## Resolution

Explicit frames distinguish main movement, other movement, warp, passing, arrival, trip, reroll, power occurrence, finish and elimination. Resolve atomic movement groups before stop reactions. Keep finalized die separate from modified distance. Priority is track, current owner, other owners clockwise; same-owner racers follow established order. Optional effects suspend into owner-specific decisions and resume the queue without rerunning prior effects.

Power lookup delegates copied handlers while retaining copier identity and its own memory. Copy Cat source is stable during an indivisible action; original power wins direct conflicts. Completed powers emit occurrences for Scoocher, including one per Leaptoad skipped occupied space. True repeated mechanical states stop only their cycle; a defensive depth bound is diagnostic and must never silently replace legal gameplay.

## Authority and privacy

Supabase persists `game_rooms`, `game_members`, `game_commands` and rate counters. Edge verifies JWTs via Auth.getUser and derives p0/p1/etc. from membership. Only service_role may execute mutation RPCs. Row locks and expected versions make state/events/random outcomes atomic; command IDs/digests make retries idempotent. A transaction broadcasts only room ID/version through a membership-authorized private topic. GET/action responses contain player-specific projections. Shared engine deployment uses an esbuild ESM bundle, avoiding a separate Deno rules implementation. Schema/rules/engine versions guard incompatible saves.

Persist full room state only behind server access. Clients submit actions and expected versions, never replacement state. Resolve actor from room membership credentials, validate legal action server-side, serialize updates transactionally, and return only the caller's projection. Never expose hidden selections, deck order, RNG history/state or decision context through public reads/events. Nickname-based entry does not grant authority over another member. Reconnect restores member identity and current projected state; stale retries must not execute twice.

## Presentation and verification

Render board/racer cards, active actor, scores, pending choices and readable causal events. Use original symbolic assets, responsive touch controls, keyboard focus and reduced motion. Test pure engine behavior, seeded complete games, adversarial commands, projected privacy and browser user journeys separately. Production configuration must explain backend setup, privileged-secret boundaries and the fact that noindex is not authentication.
