import { describe, expect, it } from "vitest";
import {
  COLUMN_PITCH,
  LAST_POSITION,
  pawnSlots,
  ROW_PITCH,
  tileRect,
  trackBounds,
} from "../apps/web/src/three/trackLayout3d";

const positions = Array.from({ length: LAST_POSITION + 1 }, (_, i) => i);

describe("3D track layout", () => {
  it("keeps every space inside the track bounds without overlaps", () => {
    const bounds = trackBounds();
    const rects = positions.map(tileRect);
    for (const rect of rects) {
      expect(rect.x - rect.width / 2).toBeGreaterThanOrEqual(bounds.minX);
      expect(rect.x + rect.width / 2).toBeLessThanOrEqual(bounds.maxX);
      expect(rect.z - rect.depth / 2).toBeGreaterThanOrEqual(bounds.minZ);
      expect(rect.z + rect.depth / 2).toBeLessThanOrEqual(bounds.maxZ);
    }
    for (let a = 0; a < rects.length; a++)
      for (let b = a + 1; b < rects.length; b++) {
        const apartX =
          Math.abs(rects[a].x - rects[b].x) >=
          (rects[a].width + rects[b].width) / 2;
        const apartZ =
          Math.abs(rects[a].z - rects[b].z) >=
          (rects[a].depth + rects[b].depth) / 2;
        expect(apartX || apartZ, `spaces ${a} and ${b} overlap`).toBe(true);
      }
  });

  it("follows the U route: right along the top, down the corner, left along the bottom", () => {
    for (let position = 2; position <= 12; position++) {
      expect(tileRect(position).x - tileRect(position - 1).x).toBeCloseTo(
        COLUMN_PITCH,
      );
      expect(tileRect(position).z).toBeCloseTo(tileRect(1).z);
    }
    for (let position = 13; position <= 15; position++) {
      expect(tileRect(position).x).toBeCloseTo(tileRect(12).x);
      expect(tileRect(position).z - tileRect(position - 1).z).toBeCloseTo(
        ROW_PITCH,
      );
    }
    for (let position = 16; position <= 29; position++) {
      expect(tileRect(position - 1).x - tileRect(position).x).toBeCloseTo(
        COLUMN_PITCH,
      );
      expect(tileRect(position).z).toBeCloseTo(tileRect(15).z);
    }
  });

  it("gives Start three columns and puts Finish between the straights", () => {
    expect(tileRect(0).width).toBeGreaterThan(tileRect(1).width * 2.5);
    const finish = tileRect(LAST_POSITION);
    expect(finish.x).toBeCloseTo(tileRect(29).x);
    expect(finish.z).toBeGreaterThan(tileRect(0).z);
    expect(finish.z).toBeLessThan(tileRect(29).z);
  });

  it("clamps positions beyond Finish onto the Finish space", () => {
    expect(tileRect(34)).toEqual(tileRect(LAST_POSITION));
    expect(tileRect(-2)).toEqual(tileRect(0));
  });

  it("places every sharing pawn on its own spot inside the space", () => {
    for (const position of [0, 7, LAST_POSITION]) {
      const rect = tileRect(position);
      for (let count = 1; count <= 6; count++) {
        const slots = pawnSlots(count, rect);
        expect(slots).toHaveLength(count);
        const keys = new Set(slots.map((slot) => `${slot.x}:${slot.z}`));
        expect(keys.size).toBe(count);
        for (const slot of slots)
          expect(Math.abs(slot.x)).toBeLessThanOrEqual(rect.width / 2);
      }
    }
    expect(pawnSlots(0, tileRect(3))).toEqual([]);
  });

  it("alternates flag heights between neighbours on a shared space", () => {
    const [left, right] = pawnSlots(2, tileRect(9));
    expect(left.tier).not.toBe(right.tier);
  });
});
