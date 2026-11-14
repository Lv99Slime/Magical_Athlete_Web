import { describe, expect, it } from "vitest";
import {
  CHEER_MS,
  cheerPose,
  CONFETTI_MS,
  confettiPiece,
  confettiPose,
  FALL_MS,
  fallAmount,
  focusPawn,
  HOP_HEIGHT,
  HOP_MS,
  hopPose,
  LANDING_MS,
  RISE_MS,
  travelKind,
  WARP_MS,
  warpPose,
} from "../apps/web/src/three/pawnMotion";

const move = { event: { type: "MOVE", racerId: "a" }, movingIds: ["a", "b"] };
const warp = { event: { type: "WARP", racerId: "a" }, movingIds: ["a"] };

describe("how a pawn travels to a new spot", () => {
  it("hops when the playback says it is moving and folds away when it warps", () => {
    expect(travelKind("a", move)).toBe("hop");
    expect(travelKind("b", move)).toBe("hop");
    expect(travelKind("a", warp)).toBe("warp");
  });

  it("only glides when it is making room or there is no playback", () => {
    expect(travelKind("c", move)).toBe("glide");
    expect(travelKind("a", undefined)).toBe("glide");
    expect(travelKind("a", { event: { type: "POWER_TRIGGERED" } })).toBe(
      "glide",
    );
  });
});

describe("hop pose", () => {
  it("leaves the ground, peaks mid-way and lands exactly on the new spot", () => {
    const start = hopPose(0);
    expect(start.travel).toBe(0);
    expect(start.lift).toBe(0);
    const middle = hopPose(HOP_MS / 2);
    expect(middle.travel).toBeCloseTo(0.5, 5);
    expect(middle.lift).toBeCloseTo(HOP_HEIGHT, 5);
    const landed = hopPose(HOP_MS);
    expect(landed.travel).toBe(1);
    expect(landed.lift).toBeCloseTo(0, 5);
    expect(landed.done).toBe(false);
  });

  it("squashes on landing and then rests at full height", () => {
    const squashed = hopPose(HOP_MS + LANDING_MS / 2);
    expect(squashed.squash).toBeLessThan(0.95);
    expect(squashed.travel).toBe(1);
    const rest = hopPose(HOP_MS + LANDING_MS);
    expect(rest.squash).toBeCloseTo(1, 5);
    expect(rest.done).toBe(true);
    expect(hopPose(99999)).toEqual(rest);
  });

  it("never goes below the page or runs backwards on odd clocks", () => {
    for (const elapsed of [-50, 0, 20, 90, 140, 400]) {
      const pose = hopPose(elapsed);
      expect(pose.lift).toBeGreaterThanOrEqual(0);
      expect(pose.travel).toBeGreaterThanOrEqual(0);
      expect(pose.travel).toBeLessThanOrEqual(1);
    }
  });
});

describe("warp pose", () => {
  it("folds flat where it stood before appearing at the new spot", () => {
    expect(warpPose(0)).toMatchObject({ travel: 0, fold: 1 });
    const folding = warpPose(WARP_MS * 0.3);
    expect(folding.travel).toBe(0);
    expect(folding.fold).toBeLessThan(0.6);
    const popping = warpPose(WARP_MS * 0.6);
    expect(popping.travel).toBe(1);
    expect(popping.fold).toBeGreaterThan(0);
  });

  it("finishes standing upright and never collapses to zero size", () => {
    const end = warpPose(WARP_MS);
    expect(end).toMatchObject({ travel: 1, done: true });
    expect(end.fold).toBeCloseTo(1, 5);
    for (let elapsed = 0; elapsed <= WARP_MS; elapsed += 10)
      expect(warpPose(elapsed).fold).toBeGreaterThan(0);
  });
});

describe("tripping and getting back up", () => {
  it("falls all the way over and stays within sensible bounds", () => {
    expect(fallAmount(0, 0, 1)).toBe(0);
    expect(fallAmount(FALL_MS, 0, 1)).toBeCloseTo(1, 5);
    expect(fallAmount(FALL_MS * 5, 0, 1)).toBeCloseTo(1, 5);
    for (let elapsed = 0; elapsed <= FALL_MS; elapsed += 20) {
      const amount = fallAmount(elapsed, 0, 1);
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(1);
    }
  });

  it("stands back up, and continues from a half-finished fall", () => {
    expect(fallAmount(RISE_MS, 1, 0)).toBeCloseTo(0, 5);
    expect(fallAmount(0, 0.4, 0)).toBeCloseTo(0.4, 5);
    expect(fallAmount(RISE_MS, 0.4, 0)).toBeCloseTo(0, 5);
    expect(fallAmount(123, 1, 1)).toBe(1);
  });
});

describe("finish celebration", () => {
  it("jumps, turns once and ends back on the ground facing forward", () => {
    expect(cheerPose(0)).toMatchObject({ lift: 0, done: false });
    expect(cheerPose(CHEER_MS * 0.3).lift).toBeGreaterThan(HOP_HEIGHT);
    const end = cheerPose(CHEER_MS);
    expect(end.done).toBe(true);
    expect(end.lift).toBeCloseTo(0, 5);
    expect(Math.sin(end.turn)).toBeCloseTo(0, 5);
    expect(Math.cos(end.turn)).toBeCloseTo(1, 5);
  });
});

describe("paper confetti", () => {
  it("is the same every time for the same burst", () => {
    expect(confettiPiece(3, 17)).toEqual(confettiPiece(3, 17));
    expect(confettiPiece(3, 17)).not.toEqual(confettiPiece(4, 17));
  });

  it("starts at the pawn, flies up and never sinks into the page", () => {
    for (let index = 0; index < 40; index++) {
      const piece = confettiPiece(index, 9);
      const start = confettiPose(piece, 0);
      expect(Math.hypot(start.x, start.z)).toBeLessThan(0.01);
      expect(confettiPose(piece, 200).y).toBeGreaterThan(start.y);
      for (let elapsed = 0; elapsed <= CONFETTI_MS; elapsed += 100)
        expect(confettiPose(piece, elapsed).y).toBeGreaterThanOrEqual(0);
      expect(confettiPose(piece, CONFETTI_MS).scale).toBeCloseTo(0, 5);
    }
  });
});

describe("which pawn the camera follows", () => {
  const pawns = [
    { id: "a", active: false },
    { id: "b", active: true },
    { id: "c", active: false },
  ];

  it("follows the racer whose turn it is when nothing is playing", () => {
    expect(focusPawn(pawns, undefined)?.id).toBe("b");
  });

  it("follows the pawn that is moving, then the racer an event is about", () => {
    expect(focusPawn(pawns, { ...move, movingIds: ["c", "a"] })?.id).toBe("c");
    expect(
      focusPawn(pawns, { event: { type: "RACER_TRIPPED", racerId: "a" } })?.id,
    ).toBe("a");
  });

  it("falls back to the active racer when the event's racer left the board", () => {
    expect(
      focusPawn(pawns, { event: { type: "RACER_ELIMINATED", racerId: "z" } })
        ?.id,
    ).toBe("b");
    expect(focusPawn([], move)).toBeUndefined();
  });
});
