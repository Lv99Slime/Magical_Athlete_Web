import { describe, it, expect } from "vitest";
import { createGame, seededRandom, RACERS } from "../packages/engine/src/index";
import { Runtime } from "../packages/engine/src/runtime";
import { powers } from "../packages/engine/src/powers";
function fixture(
  ids: string[],
  positions: number[] = ids.map(() => 0),
  face = 4,
) {
  const s = createGame(
    { names: ids.map((_, i) => `P${i}`), randomTeams: true },
    seededRandom(5),
  );
  s.events = [];
  s.phase = "race";
  s.racers = ids.map((id, i) => ({
    id,
    racerId: id,
    powerId: id,
    ownerId: `p${i}`,
    position: positions[i],
    status: "active",
    tripped: false,
    memory: {},
  }));
  s.turnOrder = ids;
  s.turnIndex = 0;
  s.starter = 0;
  s.turn = {
    racerId: ids[0],
    start: positions[0],
    skip: false,
    extra: false,
    magicianRerolls: 0,
    dicemongerUsed: false,
    face,
    amount: face,
  };
  s.queue = [];
  s.raceStartScores = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  return new Runtime(s, () => 0.5);
}
function trigger(
  c: Runtime,
  timing: string,
  data: any = { racerId: c.current!.id },
) {
  c.trigger(timing, data);
  c.resolve();
}
function choose(c: Runtime, id: string) {
  expect(c.s.pending?.options.some((o) => o.id === id)).toBe(true);
  c.choose(id);
  c.resolve();
}
describe("all 36 original racer mechanics", () => {
  it("catalogue and executable registry contain exactly the same 36 identities", () =>
    expect(Object.keys(powers).sort()).toEqual(RACERS.map((r) => r.id).sort()));
  it("Alchemist replaces amount without changing die face", () => {
    const c = fixture(["alchemist", "twin"], [0, 4], 1);
    trigger(c, "die", { racerId: "alchemist", face: 1 });
    choose(c, "yes");
    expect(c.s.turn?.amount).toBe(4);
    expect(c.s.turn?.face).toBe(1);
  });
  it("Blimp snapshots second-corner threshold at turn start", () => {
    const c = fixture(["blimp", "twin"], [14, 4]);
    trigger(c, "turnStart");
    c.racer("blimp").position = 16;
    trigger(c, "amount");
    expect(c.s.turn?.amount).toBe(7);
  });
  it("Coach includes itself and modifies shared main movement", () => {
    const c = fixture(["coach", "twin"], [5, 5]);
    trigger(c, "amount");
    expect(c.s.turn?.amount).toBe(5);
  });
  it("Baba Yaga trips an arriving racer", () => {
    const c = fixture(["twin", "baba_yaga"], [4, 6]);
    c.push(c.move(c.racer("twin"), 2));
    c.resolve();
    expect(c.racer("twin").tripped).toBe(true);
  });
  it("Centaur hoofwhacks every passed racer, clamped at Start", () => {
    const c = fixture(["centaur", "twin"], [0, 1]);
    c.push(c.move(c.racer("centaur"), 3));
    c.resolve();
    expect(c.racer("twin").position).toBe(0);
  });
  it("Copy Cat changes effective source at legal boundaries and excludes itself", () => {
    const c = fixture(["copy_cat", "legs", "gunk"], [1, 5, 3]);
    expect(c.power(c.racer("copy_cat"))).toBe("legs");
    c.racer("gunk").position = 6;
    expect(c.power(c.racer("copy_cat"))).toBe("gunk");
    c.racer("copy_cat").position = 7;
    expect(c.power(c.racer("copy_cat"))).toBe("");
  });
  it("Banana trips after the complete pass, never truncates movement", () => {
    const c = fixture(["twin", "banana"], [0, 2]);
    c.push(c.move(c.racer("twin"), 4));
    c.resolve();
    expect(c.racer("twin").position).toBe(4);
    expect(c.racer("twin").tripped).toBe(true);
  });
  it("Cheerleader moves tied-last group then itself once", () => {
    const c = fixture(["cheerleader", "twin", "legs"], [5, 0, 0]);
    trigger(c, "beforeMain");
    choose(c, "yes");
    expect(c.s.racers.map((r) => r.position)).toEqual([6, 2, 2]);
  });
  it("Dicemonger moves only on its granted reroll", () => {
    const c = fixture(["magician", "dicemonger"], [0, 0]);
    c.push({ kind: "rerollWindow" });
    c.resolve();
    choose(c, "magician");
    expect(c.racer("dicemonger").position).toBe(0);
    choose(c, "dicemonger");
    expect(c.racer("dicemonger").position).toBe(1);
    expect(c.s.turn?.magicianRerolls).toBe(1);
    expect(c.s.turn?.dicemongerUsed).toBe(true);
  });
  it("Duelist wins tied duel and moves 2 outside own turn", () => {
    const c = fixture(["twin", "duelist"], [3, 5]);
    c.push(c.move(c.racer("twin"), 2));
    c.resolve();
    choose(c, "twin");
    expect(c.racer("duelist").position).toBe(7);
  });
  it("Genius earns another full turn for matching finalized prediction", () => {
    const c = fixture(["genius", "twin"]);
    trigger(c, "beforeMain");
    choose(c, "4");
    trigger(c, "die", { racerId: "genius", face: 4 });
    expect(c.s.turn?.extra).toBe(true);
  });
  it("Heckler measures absolute full-turn displacement including recovery", () => {
    const c = fixture(["twin", "heckler"], [4, 8]);
    trigger(c, "turnEnd", { racerId: "twin", start: 4 });
    expect(c.racer("heckler").position).toBe(10);
  });
  it("Egg retires three offered cards and executes copied before-race power", () => {
    const c = fixture(["egg", "twin"]);
    c.s.deck = ["sisyphus", "legs", "gunk", "coach"];
    trigger(c, "beforeRace");
    choose(c, "sisyphus");
    expect(c.racer("egg").powerId).toBe("sisyphus");
    expect(c.s.players[0].score).toBe(4);
    expect(c.s.deck).toEqual(["coach"]);
  });
  it("Gunk reduces amount, never the die face", () => {
    const c = fixture(["twin", "gunk"], [0, 0], 6);
    trigger(c, "amount");
    expect(c.s.turn?.amount).toBe(5);
    expect(c.s.turn?.face).toBe(6);
  });
  it("Huge Baby displaces arrivals without producing a move", () => {
    const c = fixture(["twin", "huge_baby"], [3, 5]);
    c.push(c.move(c.racer("twin"), 2));
    c.resolve();
    expect(c.racer("twin").position).toBe(4);
    expect(c.s.events.filter((e) => e.type === "MOVE")).toHaveLength(1);
  });
  it("Flip Flop swaps simultaneously without rolling", () => {
    const c = fixture(["flip_flop", "twin"], [3, 12]);
    c.push({ kind: "mainReady" });
    c.resolve();
    choose(c, "twin");
    expect(c.racer("flip_flop").position).toBe(12);
    expect(c.racer("twin").position).toBe(3);
    expect(c.s.events.some((e) => e.type === "DIE_ROLLED")).toBe(false);
  });
  it("Hare skips main move when alone in lead at turn start", () => {
    const c = fixture(["hare", "twin"], [8, 3]);
    trigger(c, "turnStart");
    expect(c.s.turn?.hareSkip).toBe(true);
  });
  it("Hypnotist warps Baba Yaga and gets tripped without losing whole turn", () => {
    const c = fixture(["hypnotist", "baba_yaga"], [5, 10]);
    trigger(c, "beforeMain");
    choose(c, "baba_yaga");
    expect(c.racer("baba_yaga").position).toBe(5);
    expect(c.racer("hypnotist").tripped).toBe(true);
  });
  it("Inchworm cancels final-one main movement and wriggles", () => {
    const c = fixture(["alchemist", "inchworm"], [3, 6], 1);
    trigger(c, "die", { racerId: "alchemist", face: 1 });
    choose(c, "yes");
    expect(c.s.turn?.skip).toBe(true);
    expect(c.racer("inchworm").position).toBe(7);
  });
  it("Legs fixed five receives Coach and Gunk modifiers", () => {
    const c = fixture(["legs", "coach", "gunk"], [2, 2, 9]);
    c.push({ kind: "mainReady" });
    c.resolve();
    choose(c, "fixed");
    expect(c.racer("legs").position).toBe(7);
  });
  it("Mastermind self-prediction gives first and second awards", () => {
    const c = fixture(["mastermind", "twin"], [29, 1]);
    c.racer("mastermind").memory.prediction = "mastermind";
    c.push(c.move(c.racer("mastermind"), 1));
    c.resolve();
    expect(c.s.placements).toEqual(["mastermind", "mastermind"]);
    expect(c.s.players[0].score).toBe(4);
    expect(c.s.phase).toBe("results");
  });
  it("Lackey moves before another racer moves on finalized six", () => {
    const c = fixture(["twin", "lackey"], [1, 4], 6);
    trigger(c, "die", { racerId: "twin", face: 6 });
    expect(c.racer("lackey").position).toBe(6);
    expect(c.racer("twin").position).toBe(1);
  });
  it("Loveable Loser gains one before main move only alone last", () => {
    const c = fixture(["loveable_loser", "twin"], [1, 4]);
    trigger(c, "beforeMain");
    expect(c.s.players[0].score).toBe(1);
  });
  it("M.O.U.T.H. eliminates exactly one victim and ends with survivor", () => {
    const c = fixture(["mouth", "twin"], [3, 5]);
    c.push(c.move(c.racer("mouth"), 2));
    c.resolve();
    expect(c.racer("twin").status).toBe("eliminated");
    expect(c.s.placements).toEqual(["mouth"]);
    expect(c.s.phase).toBe("results");
  });
  it("Leaptoad skips occupied spaces even backwards", () => {
    const c = fixture(["leaptoad", "twin"], [5, 4]);
    c.push(c.move(c.racer("leaptoad"), -2));
    c.resolve();
    expect(c.racer("leaptoad").position).toBe(2);
  });
  it("Magician offers exactly two own rerolls and only finalizes accepted result", () => {
    const c = fixture(["magician", "twin"]);
    c.push({ kind: "rerollWindow" });
    c.resolve();
    choose(c, "magician");
    choose(c, "magician");
    expect(c.s.events.filter((e) => e.type === "DIE_FINALIZED")).toHaveLength(
      1,
    );
    expect(c.racer("magician").position).toBe(4);
  });
  it("Party Animal pulls simultaneously then counts settled companions", () => {
    const c = fixture(["party_animal", "twin", "legs"], [4, 3, 5]);
    trigger(c, "beforeMain");
    expect(c.s.racers.map((r) => r.position)).toEqual([4, 4, 4]);
    trigger(c, "amount");
    expect(c.s.turn?.amount).toBe(6);
  });
  it("Rocket Scientist doubles base then adds Coach modifier and trips", () => {
    const c = fixture(["rocket_scientist", "coach"], [2, 2], 3);
    trigger(c, "die", { racerId: "rocket_scientist", face: 3 });
    choose(c, "yes");
    trigger(c, "amount");
    expect(c.s.turn?.amount).toBe(7);
    expect(c.racer("rocket_scientist").tripped).toBe(true);
  });
  it("Sisyphus gains four then loses one and warps on six", () => {
    const c = fixture(["sisyphus", "twin"], [9, 1], 6);
    trigger(c, "beforeRace");
    trigger(c, "die", { racerId: "sisyphus", face: 6 });
    expect(c.s.players[0].score).toBe(3);
    expect(c.racer("sisyphus").position).toBe(0);
    expect(c.s.turn?.skip).toBe(true);
  });
  it("Romantic reacts to sequential arrival of exactly a pair", () => {
    const c = fixture(["twin", "legs", "romantic"], [2, 4, 9]);
    c.push(c.move(c.racer("twin"), 2));
    c.resolve();
    expect(c.racer("romantic").position).toBe(11);
  });
  it("Skipper schedules itself after finalized one, including its own", () => {
    const c = fixture(["skipper", "twin"], [0, 4], 1);
    trigger(c, "die", { racerId: "skipper", face: 1 });
    expect(c.s.nextOverride).toBe("skipper");
  });
  it("Scoocher reacts once per Leaptoad occupied space skipped", () => {
    const c = fixture(["leaptoad", "twin", "legs", "scoocher"], [1, 2, 3, 10]);
    c.push(c.move(c.racer("leaptoad"), 1));
    c.resolve();
    expect(c.racer("leaptoad").position).toBe(4);
    expect(c.racer("scoocher").position).toBe(12);
  });
  it("Stickler cancels entire overshooting power move, exempt itself", () => {
    const c = fixture(["twin", "stickler"], [29, 29]);
    c.push(c.move(c.racer("twin"), 2));
    c.resolve();
    expect(c.racer("twin").position).toBe(29);
    c.s.cycleSeen = [];
    c.push(c.move(c.racer("stickler"), 2));
    c.resolve();
    expect(c.racer("stickler").status).toBe("finished");
  });
  it("Suckerfish follows full move and takes second after carrier crosses", () => {
    const c = fixture(["legs", "suckerfish", "twin"], [28, 28, 1]);
    c.push(c.move(c.racer("legs"), 3));
    c.resolve();
    choose(c, "yes");
    expect(c.s.placements).toEqual(["legs", "suckerfish"]);
  });
  it("Third Wheel warps onto an exact pair then retains main move", () => {
    const c = fixture(["third_wheel", "legs", "twin"], [1, 8, 8]);
    trigger(c, "beforeMain");
    choose(c, "8");
    expect(c.racer("third_wheel").position).toBe(8);
    expect(c.s.turn?.skip).toBe(false);
  });
  it("Twin copies prior printed winner and activates before-race Sisyphus", () => {
    const c = fixture(["twin", "legs"]);
    c.s.history = [
      { race: 1, winner: "sisyphus", placements: [], racers: [], gains: {} },
    ];
    trigger(c, "beforeRace");
    choose(c, "sisyphus");
    expect(c.racer("twin").powerId).toBe("sisyphus");
    expect(c.s.players[0].score).toBe(4);
  });
});
