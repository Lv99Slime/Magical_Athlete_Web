import { describe, expect, it } from "vitest";
import {
  createGame,
  applyCommand,
  getLegalActions,
  projectState,
  seededRandom,
} from "../packages/engine/src/index";
import type {
  GameConfig,
  GameState,
  PlayerCommand,
} from "../packages/engine/src/types";

function available(state: GameState): PlayerCommand[] {
  return state.players.flatMap((player) =>
    getLegalActions(state, player.id).map((action) => ({
      actorId: player.id,
      action,
    })),
  );
}

describe("draft and selection public contract", () => {
  for (const count of [2, 3, 4, 5, 6]) {
    for (const double of count === 3 ? [false, true] : [false]) {
      it(`drafts unique complete teams for ${count} players, double=${double}`, () => {
        const rng = seededRandom(110 + count);
        let state = createGame(
          {
            names: Array.from({ length: count }, (_, i) => `Player ${i + 1}`),
            doubleRacers: double,
          },
          rng,
        );
        const picks: string[] = [];
        for (let guard = 0; state.phase === "draft" && guard < 100; guard++) {
          const commands = available(state).filter(
            (c) => c.action.type === "draft",
          );
          expect(commands.length).toBeGreaterThan(0);
          expect(new Set(commands.map((c) => c.actorId)).size).toBe(1);
          picks.push(commands[0].actorId);
          state = applyCommand(state, commands[0], rng);
        }
        expect(state.phase).toBe("selection");
        const teamSize = count === 2 || double ? 8 : 4;
        expect(state.players.map((p) => p.team.length)).toEqual(
          Array(count).fill(teamSize),
        );
        const all = state.players.flatMap((p) => p.team);
        expect(new Set(all).size).toBe(all.length);
        // Every snake round reverses directly at its end, so the end drafter picks twice.
        expect(picks[count - 1]).toBe(picks[count]);
        expect(picks.slice(0, count).reverse()).toEqual(
          picks.slice(count, 2 * count),
        );
      });
    }
  }

  it("projects a submitted selection only to its owner until collective reveal", () => {
    const rng = seededRandom(77);
    let state = createGame({ names: ["A", "B", "C"], randomTeams: true }, rng);
    const selection = available(state).find((c) => c.action.type === "select");
    expect(selection).toBeDefined();
    state = applyCommand(state, selection!, rng);
    const other = state.players.find((p) => p.id !== selection!.actorId)!;
    const own = projectState(state, selection!.actorId);
    const publicView = projectState(state, other.id);
    expect(own.selections[selection!.actorId]).toEqual(
      state.selections[selection!.actorId],
    );
    expect(publicView.selections[selection!.actorId] ?? []).toEqual([]);
    for (const forbidden of [
      "deck",
      "discarded",
      "randomOutcomes",
      "queue",
      "cycleSeen",
    ]) {
      expect(publicView).not.toHaveProperty(forbidden);
    }
  });

  it("rejects illegal player counts", () => {
    for (const count of [0, 1, 7]) {
      expect(() =>
        createGame(
          { names: Array(count).fill("Player") } satisfies GameConfig,
          seededRandom(1),
        ),
      ).toThrow();
    }
  });
});
