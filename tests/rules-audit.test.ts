import { describe, expect, it } from "vitest";
import { createGame, seededRandom } from "../packages/engine/src/index";
import { Runtime } from "../packages/engine/src/runtime";

// Fixture uses real state initialization and explicit engine resolution frames.
function fixture(ids: string[], positions: number[]) {
  const state = createGame(
    { names: ids.map((_, i) => `P${i}`), randomTeams: true },
    seededRandom(8),
  );
  state.phase = "race";
  state.racers = ids.map((id, i) => ({
    id,
    racerId: id,
    powerId: id,
    ownerId: state.players[i].id,
    position: positions[i],
    status: "active" as const,
    tripped: false,
    memory: {},
  }));
  state.turnOrder = ids;
  state.turnIndex = 0;
  state.turn = {
    racerId: ids[0],
    start: positions[0],
    skip: false,
    magicianRerolls: 0,
    dicemongerUsed: false,
    extra: false,
  };
  state.queue = [];
  state.raceStartScores = Object.fromEntries(
    state.players.map((p) => [p.id, 0]),
  );
  return new Runtime(state, () => 0.5);
}

describe("independent rules audit regressions", () => {
  it("Suckerfish can follow a movement caused by a simultaneous group power", () => {
    const c = fixture(["cheerleader", "suckerfish", "legs"], [6, 3, 3]);
    c.push({ kind: "group", moves: [{ id: "legs", delta: 2 }] });
    c.resolve();
    expect(c.s.pending?.kind).toBe("groupFollow");
    expect(c.s.pending?.ownerId).toBe(c.racer("suckerfish").ownerId);
    c.choose("legs");
    c.resolve();
    expect(c.racer("suckerfish").position).toBe(5);
  });

  it("Magician reroll reacts through Scoocher before a new keep/reroll choice", () => {
    const c = fixture(["magician", "scoocher", "legs"], [4, 1, 10]);
    c.s.turn!.face = 2;
    c.s.pending = {
      id: "reroll-test",
      ownerId: c.racer("magician").ownerId,
      kind: "reroll",
      prompt: "Reroll?",
      options: [{ id: "magician", label: "POOF" }],
      context: { racerId: "magician" },
    };
    c.choose("magician");
    c.resolve();
    expect(c.racer("scoocher").position).toBe(2);
    expect(c.s.pending?.kind).toBe("reroll");
  });

  it("Hypnotist may target any active racer, including itself", () => {
    const c = fixture(["hypnotist", "legs", "banana"], [13, 4, 8]);
    c.push({
      kind: "trigger",
      timing: "beforeMain",
      data: { racerId: "hypnotist" },
    });
    c.resolve();
    expect(c.s.pending?.options.map((o) => o.id)).toContain("hypnotist");
  });

  it("co-arriving pair does not trigger Romantic while an existing occupant still does", () => {
    const c = fixture(["legs", "suckerfish", "romantic"], [3, 3, 10]);
    c.push({
      kind: "commitMove",
      racerId: "legs",
      delta: 2,
      to: 5,
      skips: 0,
      followers: ["suckerfish"],
      cause: "power",
    });
    c.resolve();
    expect(c.racer("romantic").position).toBe(10);
    const existing = fixture(["legs", "banana", "romantic"], [3, 5, 10]);
    existing.push({
      kind: "commitMove",
      racerId: "legs",
      delta: 2,
      to: 5,
      skips: 0,
      cause: "power",
    });
    existing.resolve();
    expect(existing.racer("romantic").position).toBe(12);
  });
});
