import { describe, expect, it } from "vitest";
import {
  createGame,
  applyCommand,
  getLegalActions,
  seededRandom,
  replay,
  projectState,
  RACERS,
} from "../packages/engine/src/index";
import { Runtime } from "../packages/engine/src/runtime";
import type { PlayerCommand } from "../packages/engine/src/types";
function scene(ids: string[]) {
  const s = createGame(
    { names: ids.map((_, i) => `P${i}`), randomTeams: true },
    seededRandom(6),
  );
  s.phase = "race";
  s.racers = ids.map((id, i) => ({
    id,
    racerId: id,
    powerId: id,
    ownerId: `p${i}`,
    position: i * 4,
    status: "active" as const,
    tripped: false,
    memory: {},
  }));
  s.turnOrder = ids;
  s.turnIndex = 0;
  s.starter = 0;
  s.turn = {
    racerId: ids[0],
    start: 0,
    skip: false,
    extra: false,
    magicianRerolls: 0,
    dicemongerUsed: false,
  };
  return new Runtime(s, seededRandom(9));
}
describe("explicit assumptions and safety boundaries", () => {
  it("A02 earned Genius extra turn precedes pending Skipper takeover", () => {
    const c = scene(["genius", "skipper", "legs"]);
    c.s.turn!.extra = true;
    c.s.nextOverride = "skipper";
    c.push({ kind: "advanceTurn" });
    c.resolve();
    expect(c.s.turn!.racerId).toBe("genius");
    expect(c.s.nextOverride).toBe("skipper");
  });
  it("A02 Skipper takeover retains teammate relative order", () => {
    const c = scene(["legs", "skipper", "twin", "gunk"]);
    c.racer("twin").ownerId = "p1";
    c.s.turnOrder = ["legs", "twin", "skipper", "gunk"];
    c.s.nextOverride = "skipper";
    c.push({ kind: "advanceTurn" });
    c.resolve();
    expect(c.s.turnOrder.slice(0, 2)).toEqual(["skipper", "twin"]);
  });
  it("A04 Egg exhaustion offers remaining card without drawing drafted racers", () => {
    const c = scene(["egg", "legs"]);
    c.s.deck = ["coach"];
    c.trigger("beforeRace");
    c.resolve();
    expect(c.s.pending!.options.map((o) => o.id)).toEqual(["no", "coach"]);
    expect(c.s.discarded).toContain("coach");
  });
  it("A05 before-race copy recursion terminates rather than repeating setup", () => {
    const c = scene(["twin", "legs"]);
    c.s.history = [
      { race: 1, winner: "twin", placements: [], racers: [], gains: {} },
    ];
    c.trigger("beforeRace");
    c.resolve();
    c.choose("twin");
    c.resolve();
    expect(c.s.pending).toBeUndefined();
    expect(c.s.events.some((e) => e.type === "COPY_CYCLE")).toBe(true);
  });
  it("A09 highest unique result wins roll-off when top result tied", () => {
    let n = 0;
    const dice = [5 / 6, 5 / 6, 3 / 6];
    const s = createGame({ names: ["A", "B", "C"] }, () =>
      n++ < 35 ? 0.3 : dice.shift()!,
    );
    expect(s.draft.starter).toBe(2);
  });
  it("API replay consumes recorded post-initialization random outcomes", () => {
    const rng = seededRandom(722);
    const initial = createGame(
      { names: ["A", "B", "C"], randomTeams: true },
      rng,
    );
    let s = initial;
    const commands: PlayerCommand[] = [];
    for (let i = 0; i < 35; i++) {
      const cmd = s.players.flatMap((p) =>
        getLegalActions(s, p.id).map((action) => ({ actorId: p.id, action })),
      )[0];
      if (!cmd) break;
      commands.push(cmd);
      s = applyCommand(s, cmd, rng);
    }
    expect(
      replay(
        initial,
        commands,
        s.randomOutcomes.slice(initial.randomOutcomes.length),
      ),
    ).toEqual(s);
  });
  it("rejects incompatible saved engine versions without mutation", () => {
    const s = createGame({ names: ["A", "B", "C"] }, seededRandom(1));
    s.engineVersion = "future";
    const cmd = s.players.flatMap((p) =>
      getLegalActions(s, p.id).map((action) => ({ actorId: p.id, action })),
    )[0];
    expect(() => applyCommand(s, cmd, seededRandom(1))).toThrow(
      "original engine",
    );
  });
  it("private decision options/context and random history never enter another view", () => {
    const c = scene(["egg", "legs"]);
    c.s.deck = ["sisyphus", "coach", "gunk"];
    c.trigger("beforeRace");
    c.resolve();
    const other = projectState(c.s, "p1");
    expect(other.pending!.options).toEqual([]);
    expect(other.pending).not.toHaveProperty("context");
    expect(other).not.toHaveProperty("randomOutcomes");
    expect(other).not.toHaveProperty("deck");
  });
  for (const entry of RACERS)
    it(`${entry.name} deactivates on elimination`, () => {
      const c = scene([entry.id, entry.id === "legs" ? "twin" : "legs"]);
      c.s.racers[0].status = "eliminated";
      const before = structuredClone(c.s.racers[0]);
      for (const timing of [
        "beforeRace",
        "turnStart",
        "beforeMain",
        "die",
        "amount",
        "stop",
        "power",
        "turnEnd",
      ]) {
        c.trigger(timing, {
          racerId: c.s.racers[0].id,
          face: 1,
          position: 0,
          group: [],
          source: c.s.racers[1].id,
          start: 0,
        });
        c.resolve();
      }
      expect(c.s.racers[0]).toEqual(before);
      expect(c.s.pending?.ownerId).not.toBe("p0");
    });
});
