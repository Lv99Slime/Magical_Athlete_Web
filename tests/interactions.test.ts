import { describe, expect, it } from "vitest";
import fc from "fast-check";
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

describe("required interaction regressions", () => {
  it("Baba Yaga still trips Duelist after Duelist wins the priority duel and leaves", () => {
    const c = fixture(["duelist", "baba_yaga", "legs"], [4, 5, 12]);
    c.push(c.move(c.racer("duelist"), 1));
    c.resolve();
    expect(c.s.pending?.kind).toBe("duel");
    c.choose("baba_yaga");
    c.resolve();
    expect(c.racer("duelist").position).toBe(7);
    expect(c.racer("duelist").tripped).toBe(true);
  });

  it("original Huge Baby displaces a Copy Cat using its power", () => {
    const c = fixture(["copy_cat", "huge_baby", "legs"], [4, 5, 1]);
    c.racer("copy_cat").memory.copySource = "huge_baby";
    c.push(c.move(c.racer("copy_cat"), 1));
    c.resolve();
    expect(c.racer("huge_baby").position).toBe(5);
    expect(c.racer("copy_cat").position).toBe(4);
  });

  it("Gunk does not alter a six and Lackey moves before the main movement", () => {
    const c = fixture(["legs", "gunk", "lackey"], [2, 8, 12]);
    c.s.turn!.face = 6;
    c.s.turn!.amount = 6;
    c.push(
      { kind: "trigger", timing: "die", data: { racerId: "legs", face: 6 } },
      { kind: "trigger", timing: "amount", data: { racerId: "legs" } },
    );
    c.resolve();
    expect(c.racer("lackey").position).toBe(14);
    expect(c.racer("legs").position).toBe(2);
    expect(c.s.turn!.face).toBe(6);
    expect(c.s.turn!.amount).toBe(5);
  });

  it("Inchworm cancels movement before Skipper takes the next turn", () => {
    const c = fixture(["legs", "inchworm", "skipper"], [2, 8, 12]);
    c.push({
      kind: "trigger",
      timing: "die",
      data: { racerId: "legs", face: 1 },
    });
    c.resolve();
    expect(c.s.turn!.skip).toBe(true);
    expect(c.racer("inchworm").position).toBe(9);
    expect(c.s.nextOverride).toBe("skipper");
    expect(c.s.turn!.racerId).toBe("legs");
  });

  it("Party Animal pull settles Huge Baby occupancy before calculating bonus", () => {
    const c = fixture(["party_animal", "huge_baby", "legs"], [5, 4, 6]);
    c.push({
      kind: "trigger",
      timing: "beforeMain",
      data: { racerId: "party_animal" },
    });
    c.resolve();
    expect(c.racer("huge_baby").position).toBe(5);
    expect(c.racer("party_animal").position).toBe(4);
    expect(c.racer("legs").position).toBe(4);
    c.s.turn!.amount = 3;
    c.push({
      kind: "trigger",
      timing: "amount",
      data: { racerId: "party_animal" },
    });
    c.resolve();
    expect(c.s.turn!.amount).toBe(4);
  });

  it("Scoocher reacts to Gunk application exactly once", () => {
    const c = fixture(["legs", "gunk", "scoocher"], [2, 8, 12]);
    c.s.turn!.amount = 5;
    c.push({ kind: "trigger", timing: "amount", data: { racerId: "legs" } });
    c.resolve();
    expect(c.s.turn!.amount).toBe(4);
    expect(c.racer("scoocher").position).toBe(13);
  });

  it("Stickler cancels an overshooting duel reward", () => {
    const c = fixture(["duelist", "stickler", "legs"], [29, 5, 29]);
    c.push({ kind: "duelWindow" });
    c.resolve();
    c.choose("legs");
    c.resolve();
    expect(c.racer("duelist").position).toBe(29);
    expect(c.s.placements).toEqual([]);
  });

  it("Stickler validates track-caused movement with the same exact-finish rule", () => {
    const c = fixture(["legs", "stickler", "genius"], [29, 5, 10]);
    c.push(c.move(c.racer("legs"), 2, "track"));
    c.resolve();
    expect(c.racer("legs").position).toBe(29);
    c.push(c.move(c.racer("legs"), 1, "track"));
    c.resolve();
    expect(c.s.placements).toEqual(["legs"]);
  });

  it("Twin copying printed Egg starts a fresh draw and runs the chosen setup power", () => {
    const c = fixture(["twin", "banana", "legs"], [0, 0, 0]);
    c.s.history = [
      {
        race: 1,
        winner: "egg",
        placements: ["old-egg"],
        racers: [],
        gains: {},
      },
    ];
    c.s.deck = ["sisyphus", "gunk", "genius", "magician"];
    c.push({ kind: "beforeRace" });
    c.resolve();
    c.choose("egg");
    c.resolve();
    expect(c.s.pending?.options.map((o) => o.id)).toEqual([
      "no",
      "sisyphus",
      "gunk",
      "genius",
    ]);
    c.choose("sisyphus");
    c.resolve();
    expect(c.racer("twin").powerId).toBe("sisyphus");
    expect(c.s.players[0].score).toBe(4);
    expect(c.s.deck).toEqual(["magician"]);
  });

  it("recovering Loveable Loser scores and triggers Heckler without rolling", () => {
    const c = fixture(["loveable_loser", "heckler", "legs"], [1, 8, 12]);
    c.racer("loveable_loser").tripped = true;
    const before = c.s.events.filter((e) => e.type === "DIE_ROLLED").length;
    c.push({ kind: "beginTurn" });
    c.resolve();
    expect(c.s.players[0].score).toBe(1);
    expect(c.racer("loveable_loser").position).toBe(1);
    expect(c.racer("loveable_loser").tripped).toBe(false);
    expect(c.racer("heckler").position).toBe(10);
    expect(c.s.events.filter((e) => e.type === "DIE_ROLLED")).toHaveLength(
      before,
    );
  });

  it("stops a Scoocher/Huge Baby cycle after a completed recurrence", () => {
    const c = fixture(["legs", "scoocher", "huge_baby"], [2, 14, 15]);
    c.push({ kind: "notifyPower", source: "legs", powerId: "legs" });
    c.resolve();
    expect(c.racer("scoocher").position).toBe(14);
    expect(c.s.events.some((e) => e.type === "LOOP_STOPPED")).toBe(true);
    expect(c.s.queue).toEqual([]);
  });

  it("allows a progressing Scoocher/Suckerfish chain to reach Finish", () => {
    const c = fixture(["legs", "scoocher", "suckerfish"], [10, 1, 1]);
    c.push({ kind: "notifyPower", source: "legs", powerId: "legs" });
    c.resolve();
    for (let i = 0; c.s.pending && i < 80; i++) {
      expect(c.s.pending.kind).toBe("follow");
      c.choose("yes");
      c.resolve();
    }
    expect(c.s.placements).toEqual(["scoocher", "suckerfish"]);
    expect(c.s.events.some((e) => e.type === "LOOP_STOPPED")).toBe(false);
  });
});

describe("movement and ledger properties", () => {
  it("ordinary movement stays within track bounds for arbitrary signed distances", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 29 }),
        fc.integer({ min: -50, max: 50 }),
        (position, delta) => {
          const c = fixture(["legs", "genius", "magician"], [position, 8, 16]);
          c.push(c.move(c.racer("legs"), delta));
          c.resolve();
          expect(c.racer("legs").position).toBe(
            Math.max(0, Math.min(30, position + delta)),
          );
          expect(c.racer("genius").position).toBe(8);
          expect(c.racer("magician").position).toBe(16);
        },
      ),
      { seed: 2026, numRuns: 150 },
    );
  });
  it("arbitrary score changes never create negative points and match ledger", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -10, max: 10 }), { maxLength: 40 }),
        (deltas) => {
          const c = fixture(["legs", "genius", "magician"], [1, 8, 16]);
          for (const delta of deltas) {
            c.score(c.racer("legs"), delta, "property");
            expect(c.s.players[0].score).toBeGreaterThanOrEqual(0);
          }
          expect(c.s.players[0].score).toBe(
            c.s.ledger.reduce((sum, e) => sum + e.amount, 0),
          );
        },
      ),
      { seed: 2027, numRuns: 100 },
    );
  });
});
