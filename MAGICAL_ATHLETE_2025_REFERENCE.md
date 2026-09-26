# Magical Athlete (CMYK 2025) — Implementation Reference

> Purpose: source-of-truth gameplay reference for a private browser implementation.
>
> Scope: CMYK 2025 base game, with the significant August 17, 2026 official rulebook timing update incorporated.
>
> Copyright note: racer names and mechanical facts are retained for compatibility with the physical game; commercial rulebook/card prose is not reproduced here. Power explanations below are paraphrased as implementation specifications.

---

## 1. Edition and rules baseline

Build the **CMYK 2025 edition**, not the 2003 version.

Use the current base-game timing interpretation, especially the August 17, 2026 update:

1. A power whose trigger depends on racers **stopping together on a space does not trigger merely because those racers arrived simultaneously**.
2. In modes where a player controls multiple racers, the player establishes the order in which their racers take turns; the chosen order is then respected in clockwise player order.

The first change supersedes the earlier printed/base transcription that allowed stop-together triggers from simultaneous arrival. It materially affects Romantic, M.O.U.T.H., Baba Yaga and other stop/share interactions, and specifically removes the old Romantic + Suckerfish simultaneous-arrival combo.

---

## 2. Game objective

A game consists of four races. Players gain points from race placement and from certain track/racer powers. After the fourth race, the player with the highest total score wins. A tie is a shared win.

---

## 3. Components relevant to the digital version

- 36 base racers
- 36 racer cards / power identities
- 1 double-sided racetrack:
  - Mild Mile
  - Wild Wilds
- D6 dice
- first-place, second-place and bronze point values

For a digital implementation, physical chip inventory does not need to be simulated unless desired visually. The score ledger is authoritative.

---

## 4. Normal 3–6 player draft

Each player ultimately drafts four racers, one for each race.

### Draft 1

1. Reveal `2 × playerCount` racers.
2. Determine the first drafter by roll-off.
3. Draft one racer per player clockwise.
4. The final drafter immediately takes a second racer.
5. Continue in reverse order until each player has two racers.

### Draft 2

1. Reveal another `2 × playerCount` racers from the remaining deck.
2. Start with the player immediately to the left of the original draft starter.
3. Repeat the snake draft.
4. Every player now has four racers.

Simpler optional onboarding rule: deal four random racers to every player instead of drafting.

---

## 5. Two-player variant

For two players:

### Recruiting

- Reveal 8 racers.
- Snake-draft all 8 using order equivalent to `A B B A A B B A`.
- Reveal 8 more racers and repeat with the opposite player starting.
- Each player ends with 8 racers.

### Preparing each race

- Each player secretly chooses 2 unused racers.
- Reveal all 4 racers simultaneously.
- Each controlled racer has its own die / turn identity.

### Racing

- When a player's turn block occurs, they take a complete turn with both racers, one after the other, in a pre-established order.
- A power referencing “another racer” can be triggered by the same player's second racer.
- Under the current update, establish the multi-racer order clearly before resolving turns.

### Later-race starting player

- The player who gained fewer points in the previous race starts the next race.
- If tied, roll off.

---

## 6. Optional three-player double-racer variant

- Run four normal 6-card snake drafts, rotating the first drafter, until each player has 8 racers.
- Each race, every player secretly chooses 2 racers, creating a 6-racer field.
- Resolve each player's two racers in their established order.
- After race 1, the player with fewer points from the prior race starts; roll off ties.

This is optional. Standard three-player play uses one racer per player.

---

## 7. Race schedule

Default schedule:

| Race | Track | First | Second |
|---|---|---:|---:|
| 1 | Mild Mile | 3 | 1 |
| 2 | Wild Wilds | 4 | 2 |
| 3 | Mild Mile | 4 | 2 |
| 4 | Wild Wilds | 5 | 3 |

A physical group may choose another pre-agreed track schedule, but the digital default must be the table above.

---

## 8. Racer selection for a race

Before every race:

- Each player secretly chooses an unused racer from their drafted team.
- Reveal simultaneously.
- Put selected racers on Start.
- A racer may be used in only one race per game.

For double-racer variants, choose the required two racers simultaneously.

---

## 9. Starting player

### Race 1
Use a roll-off.

### Later races
The next race starts with the owner whose racer was farthest behind in the previous race; first eliminated also qualifies as the relevant trailing result where elimination occurred. If a variant gives a more specific method, follow the variant rule.

---

# 10. Fundamental rules vocabulary

These distinctions must exist in code.

## 10.1 Main move

The normal once-per-turn action: normally roll a D6 and move by that movement amount.

A racer can:

- modify its main-move amount;
- replace the die procedure;
- skip the main move;
- be forced to skip the main move because it is tripped.

A power that says “before main move” is checked once per turn at that timing point.

## 10.2 Move

A change of track position that is explicitly movement. Main moves, many racer powers and arrows produce moves.

A requested move of zero spaces is treated as no move for movement-trigger purposes.

## 10.3 Warp

A direct relocation. A warp:

- changes position;
- is not a move;
- does not create passing;
- does not trigger effects that require movement;
- can still result in a racer being stopped on a destination space, unless a specific simultaneous-arrival restriction applies.

## 10.4 Passing

For a single move, Racer A passes Racer B only when A:

1. begins that move behind B; and
2. ends that same move ahead of B.

Temporary overlap during travel does not matter.

Starting on the same space means neither racer is ahead/behind, so leaving that shared space and ending ahead does not count as a pass.

## 10.5 Sharing a space

Racers share a space when they are currently settled on the same space.

Passing through a space does not count.

## 10.6 Lead

The active racer or tied racers closest to Finish. Racers that already finished are not considered for lead.

## 10.7 Last place

The active racer or tied racers closest to Start.

## 10.8 Alone

No other active racer shares that space.

---

# 11. Stop and simultaneous-arrival rule

A racer is “stopped” after completing a move, warp, or other arrival/placement.

**Current timing update:** if two or more racers arrive simultaneously as part of one effect, do not treat that simultaneous arrival itself as satisfying a stop-together trigger.

Implementation recommendation:

```ts
interface ArrivalContext {
  destination: number;
  simultaneousGroupId?: string;
  arrivalCause: 'move' | 'warp' | 'placement';
}
```

When evaluating a stop/share trigger, check whether the relevant co-arriving racers share the same `simultaneousGroupId`. If the trigger relies only on the pair/group having arrived together, suppress it.

Existing racers already on the destination are still part of the settled board state. Carefully distinguish “co-arrived simultaneously” from “was already there”.

---

# 12. Trip

When a racer trips:

1. Finish the current movement/effect completely.
2. Mark the racer tripped.
3. On that racer's next main-move timing, skip the main move entirely; do not roll.
4. Clear the tripped status as it recovers.

A tripped racer can still:

- be moved or warped by other effects;
- trigger passive/reaction powers;
- use powers not dependent on taking the skipped main move, where timing permits.

Being tripped is therefore **not equivalent to skipping the entire turn**.

---

# 13. Rerolls

When a die is rerolled:

- the prior die face is treated as though it never happened for die-result triggers;
- only the final accepted result should fire 1/6 based reactions such as Inchworm, Skipper, or Lackey;
- the act of rerolling can itself be a racer-power occurrence and therefore matter to Scoocher.

Track reroll provenance:

```ts
rerollSource: 'magician' | 'dicemonger' | other
```

Important current interpretation for Dicemonger + Magician:

- Magician's own POOF rerolls are Magician-power events.
- Dicemonger does **not** move merely because Magician used Magician's own reroll power.
- Magician may also use the once-per-turn reroll granted by Dicemonger; that specific reroll is a Dicemonger-power use and makes Dicemonger move 1.
- This means a Magician can potentially access the Dicemonger reroll plus up to two Magician rerolls, subject to the normal “reroll the most recent roll” structure.
- Scoocher may react to each actual power occurrence appropriately.

---

# 14. Power timing and priority

If several effects need to resolve at the same timing point:

1. track-space effects;
2. current player's racer power(s);
3. other players' racer power(s), clockwise.

Do not flatten all reactions into simultaneous calculation. Resolve them through a deterministic queue so the game state can change between effects.

A triggered reaction generated by a resolved power should be processed after the triggering power reaches its proper completion point, not halfway through an indivisible action.

---

# 15. Racetrack effects

## Arrow

Stopping on an arrow causes a separate move in the arrow's direction by the displayed amount.

- It is not part of the main move.
- It can itself create passes, finishes, and further stop effects.

## Trip space

Stopping on a trip space gives the racer the trip status.

## Star

Stopping on a star gives that racer's owner +1 point.

## Track-first priority

If a track-space effect and racer power are both eligible at the same stopping timing, resolve the track first.

---

# 16. Race finish and deactivation

- A racer crosses Finish by a legal move and receives a placement when applicable.
- First finisher is first place.
- Normally, second finisher is second place and immediately ends the race.
- Powers can force alternative race-end conditions.
- Once a racer finishes or otherwise leaves the race, its racer power is inactive unless specifically stated otherwise.

## Stickler exception framework

While Stickler is active, **other racers** cannot cross Finish by movement unless the movement distance lands exactly on Finish. An overshooting movement is cancelled entirely.

This restriction applies to main movement and other movement sources. Stickler itself is exempt.

---

# 17. Score handling

Use a numeric score ledger rather than physical-chip availability as the core model.

Sources include:

- race first/second award;
- Wild Wilds star spaces;
- Loveable Loser;
- Sisyphus starting points and possible loss;
- any future expansion only if explicitly added later.

Sisyphus should not create negative points by “losing” points that do not exist.

---

# 18. Infinite loops

The base-game philosophy is:

- identify a true repeated state cycle;
- allow one complete occurrence of the loop;
- then stop that loop;
- do not mistake long but progressing chains for loops.

If the power interaction makes finishing impossible for everyone, the race can end with remaining placement points unawarded.

For software, combine rules-aware cycle signatures with a defensive maximum depth in development mode.

---

# 19. Data-driven racer system

All 36 racers are defined in `magical_athlete_2025_racers.json`.

Copy mechanisms (Copy Cat, Egg, Twin) should reference the existing power implementation by ID rather than cloning code.

A copied power should preserve:

- trigger timing;
- optional/mandatory nature;
- effect details;
- copied power's special rules;

and then apply the copying racer's own copy restrictions.

---

# 20. Key engine interaction notes

## Alchemist × 1-result reactions
Alchemist can replace the movement amount when a finalized main-move die is 1 or 2. A finalized die face of 1 is still a die face of 1 even if movement becomes 4; therefore die-result reactions should use the die face, while movement uses the replacement amount. However, Inchworm's reaction says the other racer skips that move on a 1; order/timing must be covered by a test rather than letting UI order decide it.

## Coach / Gunk × Legs
Legs' fixed movement of 5 is still a main move. Apply Coach/Gunk main-move modifiers.

## Gunk × die-result powers
Gunk changes movement amount, not die face. A finalized 6 remains a 6 for Lackey.

## Banana
Trip is applied after the passing move completes; it does not truncate the current move.

## Huge Baby
Start is exempt from its no-sharing rule. Forced displacement caused by Huge Baby is a relocation treated as stopping behind Huge Baby, not as a move.

## Party Animal × Huge Baby
If Party Animal's simultaneous pull would cause racers to settle illegally with Huge Baby, resolve Huge Baby's occupancy rule according to current priority and treat Party Animal's group motion as simultaneous for stop-trigger suppression.

## Inchworm × Skipper
On a finalized 1 by another racer: resolve Inchworm's movement, then Skipper becomes next in turn order.

## M.O.U.T.H.
If elimination leaves only one racer active, end the race immediately and give that racer whichever next placement is applicable. If no second place can exist, do not award it.

## Romantic × Suckerfish
Under the August 2026 update, Suckerfish reaches the carrier's destination simultaneously with the carrier. The pair's simultaneous arrival does not create the old Romantic stop-together trigger.

## Scoocher
Scoocher reacts to each occurrence of another racer power, not merely once per source racer's turn. Particular multi-occurrence effects (e.g. Leaptoad skipping multiple occupied spaces) can generate multiple Scoocher reactions.

## Mastermind
At the beginning of Mastermind's first turn, predict the racer that will win. If that prediction becomes correct, the race ends immediately and Mastermind takes second place. Mastermind may predict itself, potentially resulting in the same racer/owner receiving both first- and second-place awards according to the base rule.

---

# 21. Visual design guidance

The physical 2025 edition uses a playful retro/psychedelic design vocabulary: simple shapes, strong flat color, bold outlines and absurd characters.

For this private web implementation:

- create original vector/symbolic racer artwork;
- use racer names and power names for identity;
- do not copy scans or official card art;
- do not distribute proprietary fonts;
- prioritize readability over exact visual replication.

---

# 22. Privacy note for GitHub Pages

GitHub Pages is static hosting and published Pages sites are normally publicly reachable on the internet. A hard-to-guess URL, `robots.txt`, and `noindex` can reduce accidental discovery but do not make the game private.

Do not put secrets, private chat content, personal data, or privileged API keys in the repository or generated frontend bundle.

---

# 23. Acceptance checklist

A correct implementation must demonstrate all of the following:

- [ ] 36 racers available
- [ ] four-race structure
- [ ] standard snake draft
- [ ] 2-player variant
- [ ] secret simultaneous racer reveal
- [ ] Mild Mile
- [ ] Wild Wilds
- [ ] main move / move / warp distinction
- [ ] pass detection
- [ ] trip behavior
- [ ] reroll rollback semantics
- [ ] track-first trigger priority
- [ ] current-player then clockwise power priority
- [ ] August 2026 simultaneous-arrival rule
- [ ] first/second race termination
- [ ] full scoring schedule
- [ ] copied powers
- [ ] event-chain log
- [ ] infinite-loop protection
- [ ] deterministic tests
- [ ] GitHub Pages build
- [ ] local mode without external services
- [ ] online-room mode when Supabase is configured
