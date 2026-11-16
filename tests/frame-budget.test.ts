import { describe, expect, it } from "vitest";
import {
  DROP_QUALITY_BELOW,
  GIVE_UP_AFTER,
  GIVE_UP_BELOW,
  judgeWindow,
  START_VERDICT,
  windowFps,
  type FrameVerdict,
} from "../apps/web/src/three/frameBudget";
import { boardPawns, type PawnSource } from "../apps/web/src/three/boardPawns";
import { FOLD_AWAY_MS, foldAwayPose } from "../apps/web/src/three/pawnMotion";

const judgeAll = (speeds: number[], from: FrameVerdict = START_VERDICT) =>
  speeds.reduce(judgeWindow, from);

describe("3D frame budget", () => {
  it("measures frames per second over a window", () => {
    expect(windowFps(60, 2000)).toBe(30);
    expect(windowFps(0, 2000)).toBe(0);
    expect(windowFps(10, 0)).toBe(0);
  });

  it("keeps full quality while the board runs smoothly", () => {
    expect(judgeAll([60, 58, 45, DROP_QUALITY_BELOW])).toEqual(START_VERDICT);
  });

  it("drops to low quality once, without giving up straight away", () => {
    const verdict = judgeWindow(START_VERDICT, DROP_QUALITY_BELOW - 1);
    expect(verdict.quality).toBe("low");
    expect(verdict.tooSlow).toBe(false);
    // The slow window that caused the drop is not held against low quality.
    expect(verdict.slowWindows).toBe(0);
  });

  it("stays on low quality even if the frame rate recovers", () => {
    expect(judgeAll([20, 60, 60, 60]).quality).toBe("low");
  });

  it("gives up only after several slow windows in a row on low quality", () => {
    const slow = GIVE_UP_BELOW - 1;
    const nearly = judgeAll([20, ...Array(GIVE_UP_AFTER - 1).fill(slow)]);
    expect(nearly.tooSlow).toBe(false);
    expect(judgeWindow(nearly, slow).tooSlow).toBe(true);
    const interrupted = judgeAll([20, slow, slow, GIVE_UP_BELOW, slow, slow]);
    expect(interrupted.tooSlow).toBe(false);
  });

  it("hands back the same verdict when a window changes nothing", () => {
    expect(judgeWindow(START_VERDICT, 60)).toBe(START_VERDICT);
    const low = judgeWindow(START_VERDICT, 20);
    expect(judgeWindow(low, 40)).toBe(low);
  });

  it("never un-decides that the device is too slow", () => {
    const gaveUp = judgeAll([20, 5, 5, 5]);
    expect(gaveUp.tooSlow).toBe(true);
    expect(judgeWindow(gaveUp, 60).tooSlow).toBe(true);
  });
});

describe("a pawn leaving the board", () => {
  it("folds flat into the page and then is done", () => {
    expect(foldAwayPose(0)).toMatchObject({ fold: 1, done: false });
    expect(foldAwayPose(FOLD_AWAY_MS / 2).fold).toBeLessThan(1);
    const end = foldAwayPose(FOLD_AWAY_MS);
    expect(end.done).toBe(true);
    expect(end.fold).toBeLessThan(0.1);
    for (let elapsed = -20; elapsed <= FOLD_AWAY_MS * 2; elapsed += 20)
      expect(foldAwayPose(elapsed).fold).toBeGreaterThan(0);
  });

  it("is still listed, marked as gone, without taking a standing spot", () => {
    const players = [{ id: "p0" }, { id: "p1" }];
    const stays = {
      id: "b",
      ownerId: "p1",
      racerId: "b",
      position: 9,
      status: "active",
      tripped: false,
    };
    const source: PawnSource = {
      players,
      turn: { racerId: "a" },
      racers: [
        {
          ...stays,
          id: "a",
          ownerId: "p0",
          racerId: "a",
          status: "eliminated",
        },
        stays,
      ],
    };
    const [leaving, staying] = boardPawns(source);
    expect(leaving).toMatchObject({ id: "a", gone: true, active: false });
    expect(staying.gone).toBe(false);
    // It folds on the spot it had while both stood on the space.
    const [stoodAt] = boardPawns({
      ...source,
      racers: source.racers.map((racer) => ({ ...racer, status: "active" })),
    });
    expect({ x: leaving.x, z: leaving.z, tier: leaving.tier }).toEqual({
      x: stoodAt.x,
      z: stoodAt.z,
      tier: stoodAt.tier,
    });
    const [alone] = boardPawns({ players, racers: [stays] });
    expect({ x: staying.x, z: staying.z, tier: staying.tier }).toEqual({
      x: alone.x,
      z: alone.z,
      tier: alone.tier,
    });
  });
});
