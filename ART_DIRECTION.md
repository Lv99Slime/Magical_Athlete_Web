# Original illustration direction and provenance

Date: 2026-09-26

Delivered: original generated board scenery and all 36 character portraits, integrated into the home page, cards, guide, roster and race tokens. The six sprite sheets use a 3-column, 2-row layout in the supplied racer catalogue order. All numbered board spaces and effects remain rules-driven HTML, independent of the illustration.

Method: built-in image_gen via the imagegen skill. The tool exposes no model selector or verified model identifier; no specific underlying model is claimed. No CLI/API fallback was used. Three initial requests failed with network errors; generating smaller landscape sheets with a style reference succeeded. All final images were visually reviewed. These are new illustrations, not scans of official cards or boards.

## Delivered assets

- `apps/web/public/art/race-world.webp`
- `apps/web/public/art/racers-0.webp` through `racers-5.webp`

Generated PNG originals were copied into `output/art-source/` (ignored). `scripts/optimize-art.mjs` encodes delivery WebP without changing composition or dimensions. Total delivery art: 2,267,184 bytes (about 2.27 MB), compared with 17,828,457 bytes of original PNGs. Retained originals are also available at the image tool's returned paths.

## Board prompt

Create a beautiful wide landscape background illustration for an original whimsical racing board game website. 3:2 landscape. Flat hand-drawn risograph screenprint editorial cartoon, thick charcoal outlines, warm golden paper, cyan river, mint rolling hills, giant pink and yellow mushrooms, funny tiny flags, distant crooked grandstand, fluffy clouds, fantastical race festival. Detailed whimsical illustrated decorations clustered along outer edges, especially bottom left and top right. Central 80 percent should be quiet pale yellow grass with very sparse grain because HTML numbered race tiles will be overlaid there. No text, letters, numbers, watermarks, actual board grid, roads or drawn track. Charming polished tabletop box-art aesthetic with imperfect print registration and tangible paper texture. Clear palette of ochre, dusty magenta, teal, green on #EDE4CF paper. No characters from existing IP; wholly original race world.

## Character sheet 1 prompt

Landscape 3 columns by 2 rows sprite sheet, six separate original cartoon figures evenly centered on warm ivory. No text or cell borders. Playful bold black linework, flat risograph cyan pink yellow mint colors and slight paper grain. Top row: cheerful banana in running shoes, cheerleader with pompoms, roguish merchant carrying big dice. Bottom row: elegant fencer with foil, smiling brain genius with glasses, cheeky heckler shouting through megaphone. Whole bodies with 15 percent empty padding in each equal rectangular cell. These game avatars must be clear at small sizes and distinct, same drawing style.

## Background correction for sheet 1

Edit only the background of this six-character sprite sheet. Replace the entire dark charcoal gradient/glow background with flat warm ivory paper #f4ecd6 and very subtle paper grain. Keep all six characters, exact poses, colors, outlines, positions, size, canvas dimensions, six-cell layout unchanged. Remove glow, preserve the small colorful ground shadows. No text or borders.

## Character sheet 0 prompt

Style reference: first successful sheet 1 (before its background correction).

Create a NEW landscape character sprite sheet in the same cartoon linework style as the reference, but use a plain warm ivory background, NO black/grey gradient or glow. Exactly 3 columns and2 rows of equal square cells. Six completely NEW characters replacing the reference characters. Top row left to right: purple alchemist wizard holding potion; living cyan blimp with face and little feet; tracksuit coach with whistle and clipboard. Bottom row: Baba Yaga witch riding a mortar; friendly galloping centaur with magenta hair; clever cat holding mirror. All figures centered fully inside their own equal cell with15% padding, no overlap between cells, no text or borders. Bold dark ink outlines, flat cyan magenta yellow mint risograph colors and subtle paper grain. Full body poses, strong distinct silhouettes, delightful family tabletop racing game art. Keep all six cells precisely equal for CSS sprites.

## Character sheet 2 prompt

Style reference: first successful sheet 1 (before its background correction).

Create a NEW landscape character sprite sheet in the same cartoon linework style as the reference, but use a plain warm ivory background, NO black/grey gradient or glow. Exactly 3 columns and2 rows of equal square cells. Six completely NEW characters replacing the reference characters. Top row left to right: cracked egg with running legs; purple slime monster; giant joyful baby wearing diaper. Bottom row: living flipflop sandals with eyes and feet; athletic hare; hypnotist holding spiral pendulum. All figures centered fully inside their own equal cell with15% padding, no overlap between cells, no text or borders. Bold dark ink outlines, flat cyan magenta yellow mint risograph colors and subtle paper grain. Full body poses, strong distinct silhouettes, delightful family tabletop racing game art. Keep all six cells precisely equal for CSS sprites.

## Character sheet 3 prompt

Style reference: first successful sheet 1 (before its background correction).

Create a NEW landscape character sprite sheet in the same cartoon linework style as the reference, but use a plain warm ivory background, NO black/grey gradient or glow. Exactly 3 columns and2 rows of equal square cells. Six completely NEW characters replacing the reference characters. Top row left to right: small green inchworm; extremely long striped legs wearing sneakers; mastermind chess strategist in cloak holding chess king. Bottom row: loyal little lackey carrying a tray; lovable bandaged unlucky underdog; huge mouth with teeth on tiny running legs. All figures centered fully inside their own equal cell with15% padding, no overlap between cells, no text or borders. Bold dark ink outlines, flat cyan magenta yellow mint risograph colors and subtle paper grain. Full body poses, strong distinct silhouettes, delightful family tabletop racing game art. Keep all six cells precisely equal for CSS sprites.

## Character sheet 4 prompt

Style reference: first successful sheet 1 (before its background correction).

Create a NEW landscape character sprite sheet in the same cartoon linework style as the reference, but use a plain warm ivory background, NO black/grey gradient or glow. Exactly 3 columns and2 rows of equal square cells. Six completely NEW characters replacing the reference characters. Top row left to right: leaping toad; magician pulling rabbit from top hat; dancing disco party animal. Bottom row: scientist with rocket backpack; Sisyphus pushing round boulder; romantic carrying roses. All figures centered fully inside their own equal cell with15% padding, no overlap between cells, no text or borders. Bold dark ink outlines, flat cyan magenta yellow mint risograph colors and subtle paper grain. Full body poses, strong distinct silhouettes, delightful family tabletop racing game art. Keep all six cells precisely equal for CSS sprites.

## Character sheet 5 prompt

Style reference: first successful sheet 1 (before its background correction).

Create a NEW landscape character sprite sheet in the same cartoon linework style as the reference, but use a plain warm ivory background, NO black/grey gradient or glow. Exactly 3 columns and2 rows of equal square cells. Six completely NEW characters replacing the reference characters. Top row left to right: sailor skipper with cap; little sideways scooching crab; stern stickler referee carrying rulebook. Bottom row: suckerfish with round suction mouth; third wheel living unicycle creature; two matching twins sharing a scarf. All figures centered fully inside their own equal cell with15% padding, no overlap between cells, no text or borders. Bold dark ink outlines, flat cyan magenta yellow mint risograph colors and subtle paper grain. Full body poses, strong distinct silhouettes, delightful family tabletop racing game art. Keep all six cells precisely equal for CSS sprites.


