import { useState } from "react";
import { COLORS } from "../components";
import type { BoardPawn } from "./boardPawns";
import { PaperConfetti } from "./PaperConfetti";
import { PaperPawn, type PawnAct } from "./PaperPawn";
import { PaperSpotlight } from "./PaperSpotlight";
import { PAPER } from "./paperTheme";
import { travelKind, type PlaybackCue } from "./pawnMotion";

const UNKNOWN_OWNER_COLOUR = PAPER.paperEdge;
const ACT_FOR_EVENT: Record<string, PawnAct["kind"] | undefined> = {
  FINISH: "cheer",
  POWER_TRIGGERED: "flourish",
};

/** A one-off effect on the page, remembered so it outlives its playback frame. */
interface PageEffect {
  /** The event id; also seeds the confetti. */
  id: number;
  x: number;
  z: number;
}

export interface PaperPawnsProps {
  pawns: readonly BoardPawn[];
  /** The playback frame being shown, if any; it only picks the animation. */
  cue?: PlaybackCue;
  /** Reduced-motion and fast modes: everything snaps into place. */
  still?: boolean;
}

/**
 * Every pawn on the page, animated from the playback frame: movers hop or fold
 * away, a racer crossing the line celebrates under a burst of paper scraps, and
 * a racer whose power goes off gets a starburst under its feet.
 */
export function PaperPawns({ pawns, cue, still = false }: PaperPawnsProps) {
  const kind = still || !cue ? undefined : ACT_FOR_EVENT[cue.event.type];
  const actId = kind === undefined ? undefined : cue?.event.id;
  const actor =
    actId === undefined
      ? undefined
      : pawns.find((pawn) => pawn.id === cue?.event.racerId);
  const [effects, setEffects] = useState<
    Partial<Record<PawnAct["kind"], PageEffect>>
  >({});
  // Remember the latest effect of each kind so it can finish after its
  // playback frame ends, even if the other kind starts meanwhile.
  if (actor && kind && actId !== undefined && effects[kind]?.id !== actId)
    setEffects({
      ...effects,
      [kind]: { id: actId, x: actor.x, z: actor.z },
    });
  // Forget them once motion is switched off, so they cannot replay later.
  if (still && (effects.cheer || effects.flourish)) setEffects({});
  const confetti = still ? undefined : effects.cheer;
  const spotlight = still ? undefined : effects.flourish;
  return (
    <>
      {pawns.map((pawn) => (
        <PaperPawn
          key={pawn.id}
          racerId={pawn.racerId}
          colour={COLORS[pawn.playerIndex] ?? UNKNOWN_OWNER_COLOUR}
          x={pawn.x}
          z={pawn.z}
          active={pawn.active}
          tripped={pawn.tripped}
          still={still}
          tier={pawn.tier}
          gone={pawn.gone}
          travel={travelKind(pawn.id, cue)}
          act={
            actor?.id === pawn.id && kind && actId !== undefined
              ? { kind, id: actId }
              : undefined
          }
        />
      ))}
      {confetti && (
        <PaperConfetti
          key={confetti.id}
          x={confetti.x}
          z={confetti.z}
          seed={confetti.id}
        />
      )}
      {spotlight && (
        <PaperSpotlight key={spotlight.id} x={spotlight.x} z={spotlight.z} />
      )}
    </>
  );
}
