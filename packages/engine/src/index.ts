import { z } from "zod";
import { RACERS, SCHEDULE, TRACKS, racerName } from "./catalog.ts";
import { Runtime } from "./runtime.ts";
import type {
  GameConfig,
  GameState,
  PlayerCommand,
  PlayerAction,
  RandomSource,
  PlayerView,
  DomainEvent,
} from "./types.ts";
export * from "./types.ts";
export { RACERS, SCHEDULE, TRACKS, racerName };
export { seededRandom } from "./random.ts";
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft"), racerId: z.string() }).strict(),
  z
    .object({
      type: z.literal("select"),
      racerIds: z.array(z.string()).min(1).max(2),
    })
    .strict(),
  z
    .object({
      type: z.literal("choose"),
      decisionId: z.string(),
      optionId: z.string(),
    })
    .strict(),
  z.object({ type: z.literal("roll") }).strict(),
  z.object({ type: z.literal("nextRace") }).strict(),
]);
function rollOff(c: Runtime, indices: number[]) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const rolls = indices.map((i) => ({ i, n: c.die(c.s.players[i].name) }));
    const unique = rolls
      .filter((x) => rolls.filter((y) => y.n === x.n).length === 1)
      .sort((a, b) => b.n - a.n);
    if (unique.length) return unique[0].i;
  }
  throw new Error("Roll-off could not resolve");
}
function newDraft(c: Runtime) {
  const s = c.s,
    n = s.players.length;
  const starter = (s.draft.starter + s.draft.round) % n;
  const clockwise = Array.from(
    { length: n },
    (_, i) => s.players[(starter + i) % n].id,
  );
  const snake = [...clockwise, ...[...clockwise].reverse()];
  s.draft.order = n === 2 ? [...snake, ...snake] : snake;
  s.draft.cursor = 0;
  s.draft.pool = s.deck.splice(0, n === 2 ? 8 : 2 * n);
  c.log("DRAFT_STARTED", `Draft ${s.draft.round + 1} begins.`);
}
export function createGame(config: GameConfig, rng: RandomSource): GameState {
  const names = z
    .array(z.string().trim().min(1).max(30))
    .min(2)
    .max(6)
    .parse(config.names);
  if (config.doubleRacers && names.length !== 2 && names.length !== 3)
    throw new Error("Double-racer mode requires two or three players");
  const doubleRacers = names.length === 2 || !!config.doubleRacers;
  const s: GameState = {
    schemaVersion: 1,
    engineVersion: "1.0.0",
    rulesVersion: "cmyk-2025-2026-08-17",
    version: 0,
    phase: "draft",
    players: names.map((name, i) => ({
      id: `p${i}`,
      name,
      team: [],
      used: [],
      score: 0,
    })),
    config: { doubleRacers, randomTeams: !!config.randomTeams },
    deck: RACERS.map((r) => r.id),
    discarded: [],
    draft: {
      pool: [],
      order: [],
      cursor: 0,
      round: 0,
      rounds: names.length === 3 && doubleRacers ? 4 : 2,
      starter: 0,
    },
    selections: {},
    raceNumber: 1,
    racers: [],
    turnOrder: [],
    turnIndex: 0,
    starter: 0,
    extraTurns: [],
    placements: [],
    history: [],
    ledger: [],
    raceStartScores: {},
    queue: [],
    events: [],
    eventCounter: 0,
    decisionCounter: 0,
    randomOutcomes: [],
    cycleSeen: [],
  };
  const c = new Runtime(s, rng);
  for (let i = s.deck.length - 1; i > 0; i--) {
    const j = Math.floor(c.random() * (i + 1));
    [s.deck[i], s.deck[j]] = [s.deck[j], s.deck[i]];
  }
  s.draft.starter = rollOff(
    c,
    names.map((_, i) => i),
  );
  if (config.randomTeams) {
    for (const p of s.players) p.team = s.deck.splice(0, doubleRacers ? 8 : 4);
    s.phase = "selection";
  } else newDraft(c);
  return s;
}
function beginRace(c: Runtime) {
  const s = c.s;
  s.phase = "race";
  s.placements = [];
  s.raceStartScores = Object.fromEntries(s.players.map((p) => [p.id, p.score]));
  if (s.raceNumber === 1)
    s.starter = rollOff(
      c,
      s.players.map((_, i) => i),
    );
  else {
    const prev = s.history.at(-1)!;
    let candidates: number[];
    if (s.config.doubleRacers) {
      const min = Math.min(...Object.values(prev.gains));
      candidates = s.players
        .map((p, i) => (prev.gains[p.id] === min ? i : -1))
        .filter((i) => i >= 0);
    } else {
      const eliminated = prev.racers
        .filter((r) => r.status === "eliminated")
        .sort((a, b) => a.memory.eliminationOrder - b.memory.eliminationOrder);
      const remaining = prev.racers.filter((r) => r.status === "active");
      const min = Math.min(...remaining.map((r) => r.position));
      const ids = eliminated.length
        ? [eliminated[0].ownerId]
        : remaining.filter((r) => r.position === min).map((r) => r.ownerId);
      candidates = s.players
        .map((p, i) => (ids.includes(p.id) ? i : -1))
        .filter((i) => i >= 0);
      if (!candidates.length) candidates = s.players.map((_, i) => i);
    }
    s.starter =
      candidates.length === 1 ? candidates[0] : rollOff(c, candidates);
  }
  s.racers = s.players.flatMap((p) =>
    s.selections[p.id].map((id) => ({
      id: `${s.raceNumber}:${id}`,
      ownerId: p.id,
      racerId: id,
      position: 0,
      status: "active" as const,
      tripped: false,
      powerId: id,
      memory: {},
    })),
  );
  for (const p of s.players) p.used.push(...s.selections[p.id]);
  s.turnOrder = Array.from(
    { length: s.players.length },
    (_, i) => s.players[(s.starter + i) % s.players.length],
  ).flatMap((p) => s.racers.filter((r) => r.ownerId === p.id).map((r) => r.id));
  s.turnIndex = 0;
  s.turn = undefined;
  s.nextOverride = undefined;
  s.cycleSeen = [];
  c.log(
    "RACE_STARTED",
    `Race ${s.raceNumber}: ${SCHEDULE[s.raceNumber - 1].trackId === "mild_mile" ? "Mild Mile" : "Wild Wilds"}.`,
  );
  c.push({ kind: "beforeRace" }, { kind: "beginTurn" });
  c.resolve();
}
export function getLegalActions(s: GameState, actorId: string): PlayerAction[] {
  if (!s.players.some((p) => p.id === actorId)) return [];
  if (s.phase === "draft")
    return s.draft.order[s.draft.cursor] === actorId
      ? s.draft.pool.map((racerId) => ({ type: "draft", racerId }))
      : [];
  if (s.phase === "selection") {
    if (s.selections[actorId]) return [];
    const p = s.players.find((p) => p.id === actorId)!;
    const unused = p.team.filter((id) => !p.used.includes(id));
    if (!s.config.doubleRacers)
      return unused.map((id) => ({ type: "select", racerIds: [id] }));
    return unused.flatMap((a) =>
      unused
        .filter((b) => b !== a)
        .map((b) => ({ type: "select" as const, racerIds: [a, b] })),
    );
  }
  if (s.phase === "results") return [{ type: "nextRace" }];
  if (s.phase !== "race") return [];
  if (s.pending)
    return s.pending.ownerId === actorId
      ? s.pending.options.map((o) => ({
          type: "choose",
          decisionId: s.pending!.id,
          optionId: o.id,
        }))
      : [];
  return s.racers.find((r) => r.id === s.turn?.racerId)?.ownerId === actorId
    ? [{ type: "roll" }]
    : [];
}
export function applyCommand(
  input: GameState,
  command: PlayerCommand,
  rng: RandomSource,
): GameState {
  if (
    input.schemaVersion !== 1 ||
    input.engineVersion !== "1.0.0" ||
    input.rulesVersion !== "cmyk-2025-2026-08-17"
  )
    throw new Error("This saved game requires its original engine version.");
  const action = actionSchema.parse(command.action);
  const legal = getLegalActions(input, command.actorId);
  if (!legal.some((a) => JSON.stringify(a) === JSON.stringify(action)))
    throw new Error("Illegal action or wrong player");
  const s = structuredClone(input);
  const c = new Runtime(s, rng);
  s.version++;
  if (action.type === "draft") {
    const p = s.players.find((p) => p.id === command.actorId)!;
    p.team.push(action.racerId);
    s.draft.pool = s.draft.pool.filter((id) => id !== action.racerId);
    c.log("RACER_DRAFTED", `${p.name} drafts ${racerName(action.racerId)}.`);
    s.draft.cursor++;
    if (s.draft.cursor >= s.draft.order.length) {
      s.draft.round++;
      if (s.draft.round === s.draft.rounds) {
        s.phase = "selection";
        s.draft.pool = [];
      } else newDraft(c);
    }
  } else if (action.type === "select") {
    s.selections[command.actorId] = action.racerIds;
    if (s.players.every((p) => s.selections[p.id])) beginRace(c);
  } else if (action.type === "choose") {
    c.choose(action.optionId);
    c.resolve();
  } else if (action.type === "roll") {
    s.cycleSeen = [];
    c.push({ kind: "roll" });
    c.resolve();
  } else {
    s.raceNumber++;
    s.phase = "selection";
    s.selections = {};
    s.pending = undefined;
    s.queue = [];
  }
  return s;
}
export function projectEvents(events: DomainEvent[], viewerId: string) {
  return events
    .filter((e) => !e.privateTo || e.privateTo === viewerId)
    .map((e) => structuredClone(e));
}
export function projectState(s: GameState, viewerId: string): PlayerView {
  const {
    deck,
    discarded: _discarded,
    selections,
    queue: _queue,
    cycleSeen: _cycle,
    randomOutcomes: _rng,
    pending,
    ...publicState
  } = structuredClone(s);
  return {
    ...publicState,
    events: projectEvents(s.events, viewerId),
    deckCount: deck.length,
    selections:
      s.phase === "selection"
        ? {
            ...(selections[viewerId]
              ? { [viewerId]: selections[viewerId] }
              : {}),
          }
        : selections,
    selectionReady: Object.keys(selections),
    pending: pending
      ? {
          id: pending.id,
          ownerId: pending.ownerId,
          kind: pending.kind,
          prompt:
            pending.ownerId === viewerId
              ? pending.prompt
              : "Waiting for another player",
          options: pending.ownerId === viewerId ? pending.options : [],
        }
      : undefined,
    legalActions: getLegalActions(s, viewerId),
  };
}
export function replay(
  initial: GameState,
  commands: PlayerCommand[],
  outcomes: number[],
): GameState {
  let i = 0;
  return commands.reduce(
    (s, c) =>
      applyCommand(s, c, () => {
        if (i >= outcomes.length)
          throw new Error("Replay randomness exhausted");
        return outcomes[i++];
      }),
    structuredClone(initial),
  );
}
