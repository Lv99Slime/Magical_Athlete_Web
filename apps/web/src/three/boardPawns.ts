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
  /** Eliminated: the pawn folds away where it stood and takes no spot. */
  gone: boolean;
}

/**
 * Where every racer stands. Finished racers rest on Finish, and racers sharing
 * a space keep their race order so they do not swap spots when someone else
 * arrives. Eliminated racers are still listed, marked `gone`, so the board can
 * fold them away; they never take a standing spot from anyone else.
 */
export function boardPawns(source: PawnSource): BoardPawn[] {
  const placed = source.racers.map((racer) => ({
    racer,
    gone: racer.status === "eliminated",
    position: Math.min(LAST_POSITION, Math.max(0, racer.position)),
  }));
  const standing = placed.filter((pawn) => !pawn.gone);
  return placed.map(({ racer, gone, position }) => {
    // A leaving pawn keeps the spot it had among everyone on its space, so
    // it folds where it stood; the others close up as if it were not there.
    const sharing = (gone ? placed : standing).filter(
      (other) => other.position === position,
    );
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
      gone,
    };
  });
}
