/**
 * World-space layout of the U route for the 3D board. Mirrors boardLayout.ts:
 * 15 columns by 4 rows, wide Start, corners at 12 and 15, Finish beside Start.
 * X grows to the right, Z grows towards the viewer, Y is up.
 */
export const COLUMNS = 15;
export const ROWS = 4;
export const COLUMN_PITCH = 1.15;
export const ROW_PITCH = 1.5;
export const TILE_GAP = 0.1;
export const TILE_HEIGHT = 0.08;
export const LAST_POSITION = 30;

export interface TileRect {
  /** Centre of the tile on the page. */
  x: number;
  z: number;
  width: number;
  depth: number;
}

interface GridSpan {
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
}

function gridSpan(position: number): GridSpan {
  if (position <= 0) return { column: 1, row: 1, columnSpan: 3, rowSpan: 1 };
  if (position <= 12)
    return { column: position + 3, row: 1, columnSpan: 1, rowSpan: 1 };
  if (position <= 15)
    return { column: 15, row: position - 11, columnSpan: 1, rowSpan: 1 };
  if (position < LAST_POSITION)
    return { column: 30 - position, row: 4, columnSpan: 1, rowSpan: 1 };
  return { column: 1, row: 2, columnSpan: 1, rowSpan: 2 };
}

export function tileRect(position: number): TileRect {
  const span = gridSpan(Math.min(LAST_POSITION, Math.max(0, position)));
  const centreColumn = span.column + (span.columnSpan - 1) / 2;
  const centreRow = span.row + (span.rowSpan - 1) / 2;
  return {
    x: (centreColumn - (COLUMNS + 1) / 2) * COLUMN_PITCH,
    z: (centreRow - (ROWS + 1) / 2) * ROW_PITCH,
    width: span.columnSpan * COLUMN_PITCH - TILE_GAP,
    depth: span.rowSpan * ROW_PITCH - TILE_GAP,
  };
}

/** True for the right-hand column, where pop-up tabs sit outside the track. */
export function isRightColumn(position: number): boolean {
  return position >= 13 && position <= 14;
}

const SLOT_SPACING_X = 0.54;
const SLOT_SPACING_Z = 0.46;

export interface PawnSlot {
  x: number;
  z: number;
  /** Flag height step: neighbours alternate so portraits do not hide each other. */
  tier: number;
}

/**
 * Standing spots for `count` pawns sharing one tile, as offsets from its centre.
 * Rows fill from the back so nearer pawns never hide the ones behind completely.
 */
export function pawnSlots(count: number, rect: TileRect): PawnSlot[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, z: 0.12, tier: 0 }];
  const perRow = Math.max(
    2,
    Math.floor((rect.width - 0.3) / SLOT_SPACING_X) + 1,
  );
  const rows = Math.ceil(count / perRow);
  const slots: PawnSlot[] = [];
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const column = index - row * perRow;
    slots.push({
      x: (column - (inRow - 1) / 2) * SLOT_SPACING_X,
      z: (row - (rows - 1) / 2) * SLOT_SPACING_Z + 0.08,
      tier: (column % 2) + (rows - 1 - row) * 2,
    });
  }
  return slots;
}

/** Outer bounds of the whole track, used to size the page and frame the camera. */
export function trackBounds(): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const halfWidth = (COLUMNS * COLUMN_PITCH) / 2;
  const halfDepth = (ROWS * ROW_PITCH) / 2;
  return {
    minX: -halfWidth,
    maxX: halfWidth,
    minZ: -halfDepth,
    maxZ: halfDepth,
  };
}
