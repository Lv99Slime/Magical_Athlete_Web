import { describe, expect, it } from "vitest";
import { boardPawns, type PawnSource } from "../apps/web/src/three/boardPawns";
import { LAST_POSITION, tileRect } from "../apps/web/src/three/trackLayout3d";

function racer(
  id: string,
  ownerId: string,
  position: number,
  extra: Partial<PawnSource["racers"][number]> = {},
): PawnSource["racers"][number] {
  return {
    id,
    ownerId,
    racerId: id,
    position,
    status: "active",
    tripped: false,
    ...extra,
  };
}

const players = [{ id: "p0" }, { id: "p1" }, { id: "p2" }];

describe("3D board pawn placement", () => {
  it("stands each racer on its own space and marks whose turn it is", () => {
    const pawns = boardPawns({
      players,
      turn: { racerId: "b" },
      racers: [racer("a", "p0", 4), racer("b", "p1", 17)],
    });
    expect(pawns.map((pawn) => pawn.id)).toEqual(["a", "b"]);
    expect(pawns[0].playerIndex).toBe(0);
    expect(pawns[1].playerIndex).toBe(1);
    expect(pawns.map((pawn) => pawn.active)).toEqual([false, true]);
    for (const pawn of pawns) {
      const rect = tileRect(pawn.position);
      expect(Math.abs(pawn.x - rect.x)).toBeLessThanOrEqual(rect.width / 2);
      expect(Math.abs(pawn.z - rect.z)).toBeLessThanOrEqual(rect.depth / 2);
    }
  });

  it("leaves eliminated racers off the board", () => {
    const pawns = boardPawns({
      players,
      racers: [
        racer("a", "p0", 9, { status: "eliminated" }),
        racer("b", "p1", 9),
      ],
    });
    expect(pawns.map((pawn) => pawn.id)).toEqual(["b"]);
  });

  it("rests finished racers on Finish, never beyond it or as active", () => {
    const [pawn] = boardPawns({
      players,
      turn: { racerId: "a" },
      racers: [racer("a", "p0", 33, { status: "finished", tripped: true })],
    });
    expect(pawn.position).toBe(LAST_POSITION);
    expect(pawn.active).toBe(false);
    expect(pawn.tripped).toBe(false);
  });

  it("gives racers sharing a space separate spots that survive a new arrival order", () => {
    const first = racer("a", "p0", 12);
    const second = racer("b", "p1", 12);
    const third = racer("c", "p2", 3);
    const before = boardPawns({ players, racers: [first, second, third] });
    const spots = before
      .filter((pawn) => pawn.position === 12)
      .map((pawn) => `${pawn.x}:${pawn.z}`);
    expect(new Set(spots).size).toBe(2);
    const after = boardPawns({
      players,
      racers: [first, second, { ...third, position: 20 }],
    });
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
  });

  it("carries the tripped flag for active racers and tolerates unknown owners", () => {
    const [pawn] = boardPawns({
      players,
      racers: [racer("a", "ghost", 6, { tripped: true })],
    });
    expect(pawn.tripped).toBe(true);
    expect(pawn.playerIndex).toBe(-1);
  });
});
