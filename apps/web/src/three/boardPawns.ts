import { LAST_POSITION, pawnSlots, tileRect } from "./trackLayout3d";

/** The slice of a player view the 3D board needs to place pawns. */
export interface PawnSource {
  racers: readonly {
    id: string;
    ownerId: string;
    racerId: string;
    position: number;
    status: string;
    tripped: boolean;
  }[];
  players: readonly { id: string }[];
  turn?: { racerId: string };
}

export interface BoardPawn {
  id: string;
  racerId: string;
  /** Index into the shared player colour list; -1 when the owner is unknown. */
  playerIndex: number;
  position: number;
  x: number;
  z: number;
  tier: number;
  active: boolean;
  tripped: boolean;
}

/**
 * Where every racer still on the board stands. Eliminated racers are left out,
 * finished racers rest on Finish, and racers sharing a space keep their race
 * order so they do not swap spots when someone else arrives.
 */
export function boardPawns(source: PawnSource): BoardPawn[] {
  const standing = source.racers
    .filter((racer) => racer.status !== "eliminated")
    .map((racer) => ({
      racer,
      position: Math.min(LAST_POSITION, Math.max(0, racer.position)),
    }));
  return standing.map(({ racer, position }) => {
    const sharing = standing.filter((other) => other.position === position);
    const rect = tileRect(position);
    const slot = pawnSlots(sharing.length, rect)[
      sharing.findIndex((other) => other.racer.id === racer.id)
    ];
    return {
      id: racer.id,
      racerId: racer.racerId,
      playerIndex: source.players.findIndex(
        (player) => player.id === racer.ownerId,
      ),
      position,
      x: rect.x + slot.x,
      z: rect.z + slot.z,
      tier: slot.tier,
      active: source.turn?.racerId === racer.id && racer.status === "active",
      tripped: racer.tripped && racer.status === "active",
    };
  });
}
