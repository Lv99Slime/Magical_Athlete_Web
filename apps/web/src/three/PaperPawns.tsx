import { useState } from "react";
import { COLORS } from "../components";
import type { BoardPawn } from "./boardPawns";
import { PaperConfetti } from "./PaperConfetti";
import { PaperPawn } from "./PaperPawn";
import { PAPER } from "./paperTheme";
import { travelKind, type PlaybackCue } from "./pawnMotion";

const UNKNOWN_OWNER_COLOUR = PAPER.paperEdge;

interface Burst {
  seed: number;
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
 * away, and a racer crossing the line celebrates under a burst of paper scraps.
 */
export function PaperPawns({ pawns, cue, still = false }: PaperPawnsProps) {
  const finishId =
    !still && cue?.event.type === "FINISH" ? cue.event.id : undefined;
  const finisher =
    finishId === undefined
      ? undefined
      : pawns.find((pawn) => pawn.id === cue?.event.racerId);
  const [burst, setBurst] = useState<Burst>();
  // Remember the latest finish so its confetti outlives the playback frame.
  if (finisher && finishId !== undefined && burst?.seed !== finishId)
    setBurst({ seed: finishId, x: finisher.x, z: finisher.z });
  // Forget it once motion is switched off, so it cannot replay later.
  if (still && burst) setBurst(undefined);
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
          travel={travelKind(pawn.id, cue)}
          cheer={finisher?.id === pawn.id ? finishId : undefined}
        />
      ))}
      {burst && !still && (
        <PaperConfetti
          key={burst.seed}
          x={burst.x}
          z={burst.z}
          seed={burst.seed}
        />
      )}
    </>
  );
}
