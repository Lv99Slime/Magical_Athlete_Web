import { describe, expect, it } from "vitest";
import { createGame, seededRandom } from "../packages/engine/src/index";
import { Runtime } from "../packages/engine/src/runtime";

function fixture(ids: string[], positions: number[]) {
  const s = createGame(
    { names: ids.map((_, i) => `P${i}`), randomTeams: true },
    seededRandom(8),
  );
  s.phase = "race";
  s.racers = ids.map((id, i) => ({
    id,
    racerId: id,
    powerId: id,
    ownerId: s.players[i].id,
    position: positions[i],
    status: "active" as const,
    tripped: false,
    memory: {},
  }));
  s.turnOrder = ids;
  s.turnIndex = 0;
  s.turn = {
    racerId: ids[0],
    start: positions[0],
    skip: false,
    magicianRerolls: 0,
    dicemongerUsed: false,
    extra: false,
  };
  s.queue = [];
  s.raceStartScores = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  return new Runtime(s, () => 0.5);
}

describe("additional independent core regressions", () => {
  it("simultaneous movers do not pass another racer remaining ahead after group movement", () => {
    const c = fixture(["centaur", "legs", "banana"], [1, 2, 10]);
    c.push({
      kind: "group",
      moves: [
        { id: "centaur", delta: 2 },
        { id: "legs", delta: 2 },
      ],
    });
    c.resolve();
    expect(c.racer("centaur").position).toBe(3);
    expect(c.racer("legs").position).toBe(4);
  });

  it("original Skipper wins a conflicting Copy Cat next-turn claim", () => {
    const c = fixture(["skipper", "copy_cat", "legs"], [10, 10, 2]);
    c.racer("copy_cat").memory.copySource = "skipper";
    c.push({
      kind: "trigger",
      timing: "die",
      data: { racerId: "skipper", face: 1 },
    });
    c.resolve();
    expect(c.s.nextOverride).toBe("skipper");
  });

  it("actual finish crossing precedes Banana to Scoocher after-move reactions", () => {
    const c = fixture(["legs", "banana", "scoocher"], [28, 29, 29]);
    c.push({
      kind: "commitMove",
      racerId: "legs",
      delta: 3,
      to: 31,
      skips: 0,
      cause: "main",
    });
    c.resolve();
    expect(c.s.placements[0]).toBe("legs");
  });

  it("Copy Cat keeps copied Magician during reroll action despite a changing lead", () => {
    const c = fixture(["copy_cat", "magician", "scoocher"], [0, 10, 10]);
    c.racer("copy_cat").memory.copySource = "magician";
    c.s.turn!.face = 2;
    c.s.pending = {
      id: "copy-reroll",
      ownerId: c.racer("copy_cat").ownerId,
      kind: "reroll",
      prompt: "Reroll?",
      options: [{ id: "magician", label: "POOF" }],
      context: { racerId: "copy_cat" },
    };
    c.choose("magician");
    c.resolve();
    expect(c.racer("scoocher").position).toBe(11);
    expect(c.s.pending?.ownerId).toBe(c.racer("copy_cat").ownerId);
    expect(c.s.pending?.kind).toBe("reroll");
    expect(c.s.pending?.options.map((o) => o.id)).toContain("magician");
  });
});
