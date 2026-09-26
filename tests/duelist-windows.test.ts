import { expect, it } from "vitest";
import { createGame, seededRandom } from "../packages/engine/src/index";
import { Runtime } from "../packages/engine/src/runtime";

it("offers off-turn Duelist a stable before-main opportunity on shared Start", () => {
  const s = createGame(
    { names: ["A", "B", "C"], randomTeams: true },
    seededRandom(8),
  );
  const ids = ["legs", "duelist", "genius"];
  s.phase = "race";
  s.racers = ids.map((id, i) => ({
    id,
    racerId: id,
    powerId: id,
    ownerId: s.players[i].id,
    position: 0,
    status: "active" as const,
    tripped: false,
    memory: {},
  }));
  s.turnOrder = ids;
  s.turnIndex = 0;
  s.queue = [];
  s.turn = {
    racerId: "legs",
    start: 0,
    skip: false,
    magicianRerolls: 0,
    dicemongerUsed: false,
    extra: false,
  };
  const c = new Runtime(s, () => 0.5);
  // Setup itself creates no stop trigger. The first actual turn is a fresh stable window.
  c.push({ kind: "trigger", timing: "beforeMain", data: { racerId: "legs" } });
  c.resolve();
  expect(s.pending?.kind).toBe("duel");
  expect(s.pending?.ownerId).toBe(s.players[1].id);
  expect(s.pending?.options.map((o) => o.id)).toContain("legs");
});
