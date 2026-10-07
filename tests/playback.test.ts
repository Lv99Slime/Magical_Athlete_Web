import { describe, expect, it } from "vitest";
import {
  createGame,
  projectState,
  seededRandom,
} from "../packages/engine/src/index";
import { Runtime } from "../packages/engine/src/runtime";
import { buildPlayback } from "../apps/web/src/racePlayback";

function fixture() {
  const s = createGame(
    { names: ["A", "B", "C"], randomTeams: true },
    seededRandom(8),
  );
  s.phase = "race";
  s.racers = ["legs", "suckerfish", "twin"].map((id, i) => ({
    id,
    racerId: id,
    powerId: id,
    ownerId: s.players[i].id,
    position: i === 2 ? 12 : 3,
    status: "active" as const,
    tripped: false,
    memory: {},
  }));
  s.queue = [];
  return new Runtime(s, () => 0.5);
}
const view = (c: Runtime) => projectState(c.s, c.s.players[0].id);
describe("presentation obeys recorded movement", () => {
  it("visits each space and moves Suckerfish alongside its carrier without mutating state", () => {
    const c = fixture(),
      before = view(c);
    c.commitMove({
      kind: "commitMove",
      racerId: "legs",
      delta: 3,
      to: 6,
      skips: 0,
      followers: ["suckerfish"],
    });
    const after = view(c),
      copy = structuredClone(after);
    const frames = buildPlayback(before, after);
    expect(
      frames
        .filter((f) => f.movingIds)
        .map((f) => f.view.racers.slice(0, 2).map((r) => r.position)),
    ).toEqual([
      [4, 4],
      [5, 5],
      [6, 6],
    ]);
    expect(after).toEqual(copy);
    expect(before.racers[0].position).toBe(3);
  });
  it("swaps atomically without traversing intermediate spaces", () => {
    const c = fixture(),
      before = view(c);
    c.push({ kind: "swap", a: "legs", b: "twin" });
    c.resolve();
    const frames = buildPlayback(before, view(c)).filter(
      (f) => f.event.type === "WARP",
    );
    expect(frames).toHaveLength(1);
    expect(frames[0].view.racers.map((r) => r.position)).toEqual([12, 3, 3]);
    expect(frames[0].cue).toBe("warp");
  });
  it("group movements play once, with every member updated together", () => {
    const c = fixture(),
      before = view(c);
    c.commitGroup({
      kind: "group",
      moves: [
        { id: "legs", delta: 2 },
        { id: "twin", delta: -2 },
      ],
    });
    const frames = buildPlayback(before, view(c));
    expect(frames).toHaveLength(2);
    expect(
      frames.map((f) => [f.view.racers[0].position, f.view.racers[2].position]),
    ).toEqual([
      [4, 11],
      [5, 10],
    ]);
  });
  it("orders real dice, power and movement; reload does not manufacture frames", () => {
    const c = fixture(),
      before = view(c);
    c.die("Legs");
    c.occurrence(c.racer("legs"));
    c.commitMove({
      kind: "commitMove",
      racerId: "legs",
      delta: -2,
      to: 1,
      skips: 0,
    });
    const after = view(c),
      frames = buildPlayback(before, after);
    expect(frames.map((f) => f.cue)).toEqual([
      "roll",
      "result",
      "power",
      "step",
      "step",
    ]);
    expect(frames[0].event.data?.face).toBe(4);
    expect(frames[0].view.events.some((e) => e.id === frames[0].event.id)).toBe(
      false,
    );
    expect(frames[1].view.events.some((e) => e.id === frames[1].event.id)).toBe(
      true,
    );
    expect(frames.slice(-2).map((f) => f.view.racers[0].position)).toEqual([
      2, 1,
    ]);
    expect(buildPlayback(after, after)).toEqual([]);
  });
  it("unequal simultaneous routes reach their destinations on the same frame", () => {
    const c = fixture(),
      before = view(c);
    c.commitGroup({
      kind: "group",
      moves: [
        { id: "legs", delta: 3 },
        { id: "twin", delta: -1 },
      ],
    });
    const frames = buildPlayback(before, view(c));
    expect(
      frames.map((f) => [f.view.racers[0].position, f.view.racers[2].position]),
    ).toEqual([
      [4, 12],
      [5, 12],
      [6, 11],
    ]);
  });
});
