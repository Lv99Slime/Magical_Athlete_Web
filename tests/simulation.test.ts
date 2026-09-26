import { describe, expect, it } from "vitest";
import {
  createGame,
  applyCommand,
  getLegalActions,
  seededRandom,
} from "../packages/engine/src/index";
import type {
  GameConfig,
  GameState,
  PlayerCommand,
} from "../packages/engine/src/types";

function commands(state: GameState): PlayerCommand[] {
  return state.players.flatMap((p) =>
    getLegalActions(state, p.id).map((action) => ({ actorId: p.id, action })),
  );
}

function simulate(config: GameConfig, seed: number) {
  const rng = seededRandom(seed);
  let state = createGame(config, rng);
  const transcript: PlayerCommand[] = [];
  for (let step = 0; state.phase !== "finished" && step < 12000; step++) {
    const legal = commands(state);
    expect(
      legal.length,
      `deadlock seed=${seed}, phase=${state.phase}, pending=${state.pending?.kind}`,
    ).toBeGreaterThan(0);
    // Deterministic policy declines optional powers where available, while selecting mandatory choices.
    const preferred = legal.find(
      (c) =>
        c.action.type === "choose" &&
        /^(skip|no|decline|keep|roll|none)$/.test(c.action.optionId),
    );
    const command = preferred ?? legal[step % legal.length];
    transcript.push(command);
    state = applyCommand(state, command, rng);
    expect(state.error, `seed=${seed}, step=${step}`).toBeUndefined();
    expect(state.players.every((p) => p.score >= 0)).toBe(true);
  }
  expect(state.phase, `seed=${seed}, actions=${transcript.length}`).toBe(
    "finished",
  );
  expect(state.history).toHaveLength(4);
  expect(state.raceNumber).toBe(4);
  const required = config.names.length === 2 || config.doubleRacers ? 8 : 4;
  for (const player of state.players) {
    expect(player.used).toHaveLength(required);
    expect(new Set(player.used).size).toBe(required);
    expect(player.score).toBe(
      state.ledger
        .filter((entry) => entry.playerId === player.id)
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
  }
  return { state, transcript };
}

describe("deterministic complete games", () => {
  for (const count of [2, 3, 4, 5, 6]) {
    for (const seed of [13, 91]) {
      it(`completes four races: ${count} players, seed ${seed}`, () => {
        simulate(
          { names: Array.from({ length: count }, (_, i) => `P${i}`) },
          seed,
        );
      });
    }
  }
  it("completes optional three-player double-racer mode", () => {
    simulate({ names: ["A", "B", "C"], doubleRacers: true }, 403);
  });
  it("replays a captured command transcript with identical injected randomness", () => {
    const config = { names: ["A", "B", "C"], randomTeams: true };
    const seed = 224;
    const original = simulate(config, seed);
    const rng = seededRandom(seed);
    let replayed = createGame(config, rng);
    for (const command of original.transcript)
      replayed = applyCommand(replayed, command, rng);
    expect(replayed).toEqual(original.state);
  });
});
