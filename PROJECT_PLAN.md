# Magical Athlete release plan

## Objective and baseline

Deliver the CMYK 2025 four-race game with August 2026 timing corrections, all 36 original powers, local pass-and-play and authoritative private online rooms. The initial repository contains reference documents and a new TypeScript workspace scaffold; no gameplay or release acceptance is implied by scaffolding.

The principal owns rules interpretation, interfaces, integration and acceptance. Source order: supplied updated gameplay reference and racer/track JSON, then provenance sources for missing details. Never import the older simultaneous-arrival examples. Interpretive decisions live in RULES_ASSUMPTIONS.md.

## Milestones and gates

1. **Planning:** read references; establish architecture, assumptions and coverage. Gate: all racers and lifecycle requirements mapped, unresolved evidence stated.
2. **Engine:** deterministic commands, resumable decisions, movement/warp/pass distinction, atomic arrival groups, track priority, trip, finish and cycle handling. Gate: core regression tests.
3. **Powers:** all 36 handler implementations, copy delegation, reroll provenance and exceptional finishes. Gate: direct coverage for every racer plus critical cross-power regressions; seeded races terminate legally.
4. **Local product:** draft variants, secret selection handoff, four races, scores, event explanations and original responsive racer visuals. Gate: complete local browser game, decision UI and mobile-size smoke checks.
5. **Online:** Supabase room command authority, private projections, reconnect and transactional version checks. Gate: two-client convergence, rejection of stale/foreign commands and reload recovery against configured backend.
6. **Release:** production build, GitHub Pages base-path workflow, setup documentation and final rules audit. Gate: clean typecheck/lint/tests/build and browser journeys; no unexplained coverage gaps or privileged secrets in bundle.

## Delegation and integration

Use isolated worktrees: principal owns engine and rule acceptance; web specialist owns presentation; multiplayer specialist owns authority/storage and deployment integration; quality specialist owns these control documents and lifecycle/simulation specifications. Specialists must preserve shared engine types, inspect the four gameplay files and never silently substitute mechanics. Integrate bounded changes only after diff review, focused tests, broader tests and production build. Record actual checks and blockers in IMPLEMENTATION_STATUS.md after integration.

## Release policy

GitHub Pages hosts the static frontend; Supabase hosts authority and persistence. Missing backend configuration leaves fully usable local mode. External deployment credentials may block live online verification, but do not block finishing engine/UI/configuration. Do not claim deployed or multiplayer-verified without evidence. Track geometry remains explicitly provisional until its supplied reconstructed coordinates are visually verified.

## Current checkpoint

Milestones 1–4 have local verification evidence. Online implementation and release configuration are integrated; milestones 5–6 remain externally gated on real Supabase tests, authenticated GitHub CI/deployment and hosted smoke tests. See IMPLEMENTATION_STATUS.md for executed checks. Agent changes were reviewed and integrated by the principal from bounded worktrees; the owner has no merge or coordination task.
# Follow-up: illustration and Traditional Chinese

## U-route and dice feedback follow-up

Implemented the supplied reference's U-shaped route and explicit corner labels, then added authoritative dice playback before visible movement. Acceptance covers geometry, contained mobile scrolling, exact face/result ordering, rerolls, saved-game resume, reduced motion and the existing full-game journeys. The game engine and track-effect data remain the existing source of mechanical truth.

- Delivered: persistent bilingual UI, all 36 translated racer descriptions, original generated board scenery, narrow-screen layout fixes.
- Acceptance: locale switching preserves the current match and ordered choices; all current static rule prompts are translated; player nicknames and replay records remain unchanged; desktop/mobile deployment paths resolve the image asset.
- Delivered: all 36 generated character portraits as six visually reviewed sprite sheets, integrated across cards, guide, home, roster and board tokens. WebP encoding reduces the seven-artwork download to about 2.27 MB.

## Immersive race playback — October 2026

Sequence projected events into dice, per-space movement, power spotlight and short synthesized audio. Canonical engine/network/save state stays immediate. Enrich movement logs with structured simultaneous arrivals (including swaps and followers); do not alter mechanics. Preserve event order, provide skip/fast/reduced-motion, persist opt-in sound/volume, and validate intermediate positions, simultaneous groups, warp, reload and final-state parity before acceptance.

Delivered this follow-up: recorded-event movement, power spotlights and opt-in synthesized sound; full 65-case browser regression and both production-subpath checks passed. All five project control files updated; gameplay interpretations unchanged.
