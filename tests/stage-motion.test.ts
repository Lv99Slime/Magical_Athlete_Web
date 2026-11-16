import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOK_OPEN_MS,
  bookOpenAmount,
  POP_MS,
  popUpAmount,
  ROLL_MS,
  SETTLE_MS,
  settlePose,
  SPOTLIGHT_MS,
  spotlightPose,
  tumblePose,
} from "../apps/web/src/three/stageMotion";
import { FLOURISH_MS, flourishPose } from "../apps/web/src/three/pawnMotion";

describe("rolling die", () => {
  it("tumbles the same way every time for the same roll", () => {
    expect(tumblePose(240, 31)).toEqual(tumblePose(240, 31));
    expect(tumblePose(240, 31)).not.toEqual(tumblePose(240, 32));
  });

  it("is thrown in from the side and ends over its resting spot", () => {
    const thrown = tumblePose(0, 5);
    expect(Math.hypot(thrown.x, thrown.z)).toBeGreaterThan(1);
    const arrived = tumblePose(ROLL_MS, 5);
    expect(Math.hypot(arrived.x, arrived.z)).toBeCloseTo(0, 5);
  });

  it("stays above the page and keeps turning while it waits for a result", () => {
    for (let elapsed = -100; elapsed <= ROLL_MS * 3; elapsed += 40)
      expect(tumblePose(elapsed, 9).y).toBeGreaterThan(0);
    const late = tumblePose(ROLL_MS * 2, 9);
    const later = tumblePose(ROLL_MS * 2 + 100, 9);
    expect(later.rotationX).not.toBe(late.rotationX);
    expect(Math.hypot(later.x, later.z)).toBeCloseTo(0, 5);
  });

  it("settles onto the page exactly when the result is shown", () => {
    expect(settlePose(0)).toMatchObject({ blend: 0, done: false });
    const middle = settlePose(SETTLE_MS / 2);
    expect(middle.blend).toBeGreaterThan(0.5);
    expect(middle.blend).toBeLessThan(1);
    const end = settlePose(SETTLE_MS);
    expect(end.blend).toBe(1);
    expect(end.hop).toBeCloseTo(0, 5);
    expect(end.done).toBe(true);
    expect(settlePose(SETTLE_MS * 9)).toEqual(end);
  });
});

describe("power spotlight", () => {
  it("pops in, holds, and is gone by the end of the playback frame", () => {
    expect(spotlightPose(0).scale).toBeCloseTo(0, 5);
    expect(spotlightPose(SPOTLIGHT_MS / 2).scale).toBeCloseTo(1, 5);
    const end = spotlightPose(SPOTLIGHT_MS);
    expect(end.scale).toBeCloseTo(0, 5);
    expect(end.done).toBe(true);
    for (let elapsed = 0; elapsed <= SPOTLIGHT_MS; elapsed += 25)
      expect(spotlightPose(elapsed).scale).toBeGreaterThanOrEqual(0);
  });

  it("keeps turning while it shows", () => {
    expect(spotlightPose(400).turn).toBeGreaterThan(spotlightPose(200).turn);
  });

  it("gives the pawn a small hop that ends at rest", () => {
    expect(flourishPose(0)).toMatchObject({ lift: 0, turn: 0, done: false });
    const middle = flourishPose(FLOURISH_MS / 2);
    expect(middle.lift).toBeGreaterThan(0);
    expect(middle.grow).toBeGreaterThan(1);
    const end = flourishPose(FLOURISH_MS);
    expect(end.lift).toBeCloseTo(0, 5);
    expect(end.grow).toBeCloseTo(1, 5);
    expect(end.done).toBe(true);
  });
});

describe("opening the book", () => {
  it("starts half shut and ends fully open", () => {
    expect(bookOpenAmount(0)).toBe(0);
    expect(bookOpenAmount(BOOK_OPEN_MS)).toBeCloseTo(1, 5);
    expect(bookOpenAmount(BOOK_OPEN_MS * 4)).toBeCloseTo(1, 5);
    expect(bookOpenAmount(-50)).toBe(0);
  });

  it("opens steadily without swinging back shut", () => {
    let previous = 0;
    for (let elapsed = 0; elapsed <= BOOK_OPEN_MS; elapsed += 20) {
      const amount = bookOpenAmount(elapsed);
      expect(amount).toBeGreaterThanOrEqual(previous);
      previous = amount;
    }
  });

  it("keeps each layer flat until its turn, then pops it up", () => {
    expect(popUpAmount(0, 300)).toBe(0);
    expect(popUpAmount(299, 300)).toBe(0);
    expect(popUpAmount(300 + POP_MS / 2, 300)).toBeGreaterThan(0.5);
    expect(popUpAmount(300 + POP_MS, 300)).toBeCloseTo(1, 5);
    expect(popUpAmount(99999, 300)).toBeCloseTo(1, 5);
  });

  it("overshoots only slightly as a layer springs up", () => {
    for (let elapsed = 0; elapsed <= POP_MS; elapsed += 10) {
      const amount = popUpAmount(elapsed, 0);
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThan(1.15);
    }
  });
});

describe("animation time source", () => {
  it("never keys off the render clock, which R3F zeroes when the frame loop changes", () => {
    const folder = join(__dirname, "../apps/web/src/three");
    const offenders = readdirSync(folder)
      .filter((name) => name.endsWith(".tsx"))
      .filter((name) =>
        readFileSync(join(folder, name), "utf8").includes("clock.elapsedTime"),
      );
    expect(offenders).toEqual([]);
  });
});
