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
# Presentation localization and artwork

The board now uses a 15-column U perimeter with a three-cell-wide Start, first corner at position 12, second corner at the existing metadata threshold 15, and Finish above the end of the lower straight. Narrow screens scroll the same route horizontally. `boardLayout.ts` maps logical positions without changing engine coordinates.

`useDicePresentation` queues incoming projected snapshots. New in-race `DIE_ROLLED` events receive 650 ms of tumbling and 550 ms of result display before committing the next visible snapshot. Canonical state/save/network processing is immediate. All choices stay disabled during playback. The actual recorded face supplies the result; the renderer consumes no random numbers. Reconnect/reload starts from the latest view without replaying historical dice; pre-race roll-offs are not animated. Fast mode and reduced motion reveal immediately. The last attributed dice result remains visible.

`I18nProvider` selects `en` or `zh-Hant` and persists the choice using `magical-locale`. New browsers default to Traditional Chinese. Translation runs only at the view boundary; canonical commands, racer IDs, events and replay data are unchanged. Player-authored nicknames are preserved. `racerTranslations.ts` contains the 36 original Chinese display translations and current engine-message translations, retaining English identities for reference.

The generated illustration is a decorative board background. Numbered spaces, effects, tokens and accessible labels remain data-driven HTML. Image prompts and provenance live in `ART_DIRECTION.md`. Generation service failures do not replace working character tokens with missing assets.

## Event playback and sound — October 2026

`racePlayback.ts` builds presentation-only frames from projected domain events. MOVE walks integer positions at 180 ms per space; WARP relocates directly. Structured `arrivals` metadata records swaps, followers and group motion; `groupId` prevents duplicate playback of the per-racer group logs. Shorter members wait at their origin so group destinations are reached in the same frame. No frame calls engine commands or triggers effects on intermediate spaces. Logs without structured arrivals fall back to the final canonical snapshot rather than prose parsing.

Power cards, track/trip/finish feedback and dice reveal follow event order. Rolling frames withhold the new die event from the visible log until its result. A sticky playback area and horizontal board tracking preserve context on phones. Skip, fast mode and live reduced-motion changes cancel the visual queue and reveal the latest state; saved/network state never waits. Sound is opt-in, with persisted volume; `gameAudio.ts` synthesizes seven bounded cues through gesture-unlocked Web Audio and silently tolerates unavailable audio devices. No external audio assets or gameplay randomness are used.

## Hosting gates

GitHub Pages builds without backend variables are local/pass-and-play releases and require the complete application CI suite. Supplying `VITE_SUPABASE_URL` additionally requires the real Supabase integration job. Pull requests and manual Verify runs default to both jobs. This split implements the owner's explicit local-first hosting scope and does not grant multiplayer acceptance.
