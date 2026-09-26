# Sources and Verification Notes

This file records the provenance used to prepare the implementation pack. It is for development verification, not for copying source text into the game.

## Primary / strongest references

- BoardGameGeek — **How to play MAGICAL ATHLETE**, current CMYK rulebook file. The file page shows the August 17, 2026 update.
  - https://boardgamegeek.com/filepage/307679/how-to-play-magical-athlete
- BoardGameGeek — Alex Hague, **A couple August 2026 rules updates**. Highlights the simultaneous-arrival change and multiple-racer turn-order structure.
  - https://boardgamegeek.com/thread/3754599/a-couple-august-2026-rules-updates/page/1
- CMYK / Magical Athlete product/how-to-play materials for the 2025 edition.
  - https://www.cmyk.games/products/magical-athlete

## Machine-readable / searchable rulebook transcription used for cross-checking

- Community-hosted English transcription of the 2025 rulebook:
  - https://github.com/keai-zeng/hunao_sport/blob/master/Magical%20Athlete%20English%20Rulebook.md

Important: that transcription contains the **older** simultaneous-arrival statement. The August 17, 2026 official update supersedes that single timing rule and related examples.

## Rules clarification used

- BoardGameGeek rules discussion on Dicemonger × Magician rerolls, referencing Alex Hague's official clarification:
  - https://boardgamegeek.com/thread/3738649/does-magician-s-reroll-trigger-dicemonger

The implementation pack therefore tracks reroll provenance instead of assuming every reroll belongs to Dicemonger.

## GitHub Pages deployment behavior

- GitHub Docs — Creating a GitHub Pages site:
  - https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

GitHub documents that Pages sites are publicly available on the internet even when the backing repository can be private. `robots.txt`, `noindex`, and a hard-to-guess URL reduce discovery but do not provide authentication.

## Track geometry note

The logical 0–30 distance model and special-space mapping in `magical_athlete_2025_tracks.json` were reconstructed from published 2025 board imagery/design references and cross-checked against reported counts of Wild Wilds space types. Because a browser implementation can keep tracks data-driven, visually verify the ten special-space positions against the owner's physical CMYK 2025 board before calling the graphic map final.

No official scans or commercial artwork are included in this pack.
