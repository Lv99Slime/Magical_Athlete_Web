# Rules assumptions and evidence

## Authority

The supplied CMYK 2025 reference incorporates August 17, 2026 updates. It overrides the linked community transcription's old simultaneous-arrival rule. All three supplied BGG rules/clarification URLs returned HTTP 403 during the initial audit; official claims below are therefore supplied-pack claims, not independently fetched confirmation. Names and mechanical identities remain exactly as supplied.

## Explicit supplied rules (not assumptions)

- Zero movement is not a move; warp does not pass. Track reactions precede current-owner then clockwise-owner powers.
- Simultaneous co-arrival alone does not trigger Romantic, Baba Yaga, M.O.U.T.H. or equivalent stop-together reactions; existing destination occupants remain relevant.
- Magician rerolls and the Dicemonger-granted reroll have separate budgets and provenance. Only the final accepted main-move die triggers 1/6 reactions.
- Trip skips main move, not the whole turn; non-main powers can still occur. Banana never truncates the passing move.
- Stickler cancels the whole overshooting move; original Stickler is exempt. Mastermind can award itself first and second. One M.O.U.T.H. survivor receives the next applicable placement.
- Fixed multi-racer order, original-copy conflict priority, numeric scoring and all four race awards are preserved.

## Chosen defaults requiring regression coverage

| ID | Decision | Evidence / qualification |
|---|---|---|
| A01 | Resolve simultaneous finish carrier before follower; independent co-finishers use current-owner/clockwise established racer order. | Pack allows Suckerfish finish but does not specify ties. |
| A02 | Genius earned extra turn resolves before pending Skipper takeover; Skipper then leads its owner block, remaining teammates follow established order, then clockwise successor. | Current-player priority; explicit conflict is not settled in pack. |
| A03 | Twin copies the previous winner's printed power and executes any copied BEFORE_RACE behavior afresh, including a new Egg draw. Do not preserve prior effective power snapshot. | Principal-approved interpretation of winner identity and copied setup. |
| A04 | Egg draws three from undealt deck, selects one as delegated power, and retires all three offers from future draw eligibility. If fewer than three remain, offer available cards; empty deck gives no new power. | Deck dispositions/exhaustion not fully specified. |
| A05 | Copy Cat excludes itself as source; copy graph recursion yields no external power for the cyclic lookup. Cache source through one atomic action; reconsider only at stable boundaries. | Sole-leader restriction is explicit; graph-cycle extension is defensive interpretation. |
| A06 | Duelist offers at stable sharing windows, including another racer's before-main window, once per Duelist/window. Declining cannot immediately reopen unchanged window; new arrivals or a new turn can create fresh opportunities. No duel interrupts roll-to-move. | tests/duelist-windows.test.ts and tests/interactions.test.ts. Initial placement alone does not trigger collisions. |
| A07 | Cycle signature includes the current mechanical frame, positions/status/power memory, turn, placements and score-zero eligibility, scoped to its causal root. Cumulative score gains alone cannot legitimize an otherwise repeating positional cycle. Complete one recurrence, suppress that effect's remaining notification/branch, preserve unrelated effects. A forced automatic turn cycle without a decision or roll ends with remaining awards unclaimed. | Reference section 18; tests/interactions.test.ts distinguishes recurrence from progressing Scoocher/Suckerfish. Seed 13 covers Copy Cat/Scoocher/star recurrence. |
| A08 | Rocket Scientist doubles the finalized base number before additive modifiers. Alchemist replacement does not defeat Inchworm cancellation. | Supplied transcription clarifies doubling die number; finalized-face distinction explicit locally. |
| A09 | Roll-off uses highest unique result; if no unique result exists, reroll. | Supplied transcription says use next highest after tied highest; all-nonunique fallback generalized. |
| A10 | Cheerleader tied-last movements form simultaneous group, followed by separate self +1. Initial Start setup does not itself emit normal stop collisions. | Coherent group/initialization interpretation; not explicit in pack. |
| A11 | Tripped racers cannot use Legs or Flip Flop to replace skipped main move; before-main powers not dependent on rolling still occur. | Reference section 12 distinction. |

## Known source limitation

Track JSON's finish 30, second corner 15 and ten Wild Wilds special spaces are authoritative implementation inputs but explicitly reconstructed. Keep data-driven and retain provisional-map notice until visual verification. This is a source-confidence limitation, not permission to invent another map.
# Translation policy

The user's supplied board image (2026-09-26) establishes the U-shaped visual route: first right corner at 12, second right corner at 15, matching the existing Blimp threshold. This presentation update does not constitute an independent audit or remapping of all special-space positions in the supplied JSON.

Traditional Chinese racer and power names are original project translations, not official localized titles. English character names remain visible for identification. UI language selection changes presentation only and introduces no gameplay ruling; the supplied English source-of-truth data and existing interpretations remain authoritative.

## Presentation-only audit — October 2026

No new gameplay ruling. Per-space visual frames are travel, not stop/arrival events; only the existing engine resolves landing, passing and track effects. WARP has no intermediate-space animation. Simultaneous arrivals are represented together from engine metadata. New sound and animation controls do not change rolls, timing priority, legal commands or scores.
