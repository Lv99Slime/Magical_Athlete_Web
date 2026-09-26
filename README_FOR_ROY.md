# How to use this Codex pack

## Recommended folder layout

Place these files at the root of the new game repository before opening the folder in Codex:

```text
magical-athlete-online/
  MAGICAL_ATHLETE_2025_CODEX_MASTER_PROMPT.md
  MAGICAL_ATHLETE_2025_REFERENCE.md
  magical_athlete_2025_racers.json
  magical_athlete_2025_tracks.json
  SOURCES_AND_VERIFICATION.md
```

Then give Codex this opening instruction:

> Read `MAGICAL_ATHLETE_2025_CODEX_MASTER_PROMPT.md` and all referenced rule/data files in this repository. Treat them as the source of truth. Build the complete game rather than a mockup. Work through the milestones autonomously, run tests and the production build, and keep going until the Definition of Done is satisfied. If an interaction remains genuinely ambiguous, record it in `RULES_ASSUMPTIONS.md` and implement the most conservative interpretation instead of stopping to ask me routine questions.

## Suggested workflow

1. Create a new empty GitHub repository, e.g. `magical-athlete-online`.
2. Clone it locally.
3. Copy this pack into the repository root.
4. Open that repository folder in Codex Desktop.
5. Paste the opening instruction above.
6. Let Codex create the Vite/React/TypeScript project and commit in milestones.
7. First make sure Local Pass-and-Play is complete and tested.
8. Then configure Supabase for true online rooms.
9. Push to GitHub and enable GitHub Pages / Actions deployment.

## Important practical point

A plain GitHub Pages app can host the UI but cannot, by itself, synchronize several remote browsers. The pack therefore tells Codex to keep **Local Pass-and-Play** fully static and use Supabase Realtime only for **Online Room** mode.

## Art assets

Do not put photographed/scanned official cards, board art, logo assets, or proprietary fonts into a public GitHub repository. Use original icons/avatars and the mechanical data in this pack.
