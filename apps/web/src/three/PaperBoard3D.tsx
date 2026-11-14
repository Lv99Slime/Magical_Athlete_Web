import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { SCHEDULE, TRACKS } from "@magical/engine";
import type { PlayerView } from "@magical/engine";
import type { DiceDisplay } from "../dicePresentation";
import { useI18n } from "../i18n";
import type { PlaybackFrame } from "../racePlayback";
import { diceForThisRace } from "../TurnConsole";
import { boardPawns } from "./boardPawns";
import { PaperDie } from "./PaperDie";
import { PaperPawns } from "./PaperPawns";
import { focusPawn } from "./pawnMotion";
import {
  bookSize,
  CameraRig,
  FIELD_OF_VIEW,
  PaperStage,
  useReducedMotion,
  type StageTrack,
} from "./PaperStage";

const DIE_REST: [number, number, number] = [5.3, 0.31, 0.45];

export interface PaperBoard3DProps {
  view: PlayerView;
  dice?: DiceDisplay;
  /** The playback frame on show; it only chooses how pawns and camera move. */
  playback?: PlaybackFrame;
  /** Fast mode: no idle motion, and frames are drawn only when something changes. */
  still?: boolean;
}

function BoardScene({
  view,
  face,
  spin,
  track,
  still,
  playback,
}: {
  view: PlayerView;
  playback?: PlaybackFrame;
  face?: number;
  spin: number;
  track: StageTrack;
  still: boolean;
}) {
  const size = useMemo(bookSize, []);
  const pawns = useMemo(() => boardPawns(view), [view]);
  const focus = focusPawn(pawns, playback);
  return (
    <>
      <PaperStage track={track}>
        <PaperPawns pawns={pawns} cue={playback} still={still} />
        {face !== undefined && (
          <PaperDie value={face} position={DIE_REST} spin={spin} />
        )}
      </PaperStage>
      <CameraRig
        size={size}
        focus={focus}
        tracking={playback !== undefined}
        still={still}
      />
    </>
  );
}

/**
 * The race board as a pop-up paper book. It only displays the player view it is
 * given: rules, legal moves and dice all stay in the engine.
 */
export default function PaperBoard3D({
  view,
  dice,
  playback,
  still = false,
}: PaperBoard3DProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const calm = still || reducedMotion;
  const schedule = SCHEDULE[Math.max(0, view.raceNumber - 1)];
  const track = TRACKS.find(
    (candidate: { id: string }) => candidate.id === schedule.trackId,
  ) as StageTrack;
  const trackLabel = t(
    track.name,
    track.id === "mild_mile" ? "悠閒一哩 · Mild Mile" : "狂野荒野 · Wild Wilds",
  );
  const shown = diceForThisRace(view, dice);
  const face =
    shown?.phase === "result" ? (shown.event.data?.face as number) : undefined;
  return (
    <section
      className="board-panel board-panel-3d"
      data-board="3d"
      aria-label={t(`${track.name} race board`, `${trackLabel}賽道`)}
    >
      <div className="board-title">
        <h2>{trackLabel}</h2>
        <span>
          {t(
            `First ${schedule.firstPoints} pts · Second ${schedule.secondPoints} pts`,
            `第一名 ${schedule.firstPoints} 分 · 第二名 ${schedule.secondPoints} 分`,
          )}
        </span>
      </div>
      <div className="board-canvas">
        <Canvas
          flat
          shadows
          dpr={[1, 2]}
          frameloop={calm ? "demand" : "always"}
          camera={{ fov: FIELD_OF_VIEW, near: 0.5, far: 120 }}
        >
          <Suspense fallback={null}>
            <BoardScene
              view={view}
              face={face}
              spin={((shown?.event.id ?? 0) % 7) * 0.45}
              track={track}
              still={calm}
              playback={calm ? undefined : playback}
            />
          </Suspense>
        </Canvas>
      </div>
      <p className="board-caption">
        {t(
          "Drag to turn the book · scroll or pinch to zoom. Positions are also listed under This race.",
          "拖曳轉動書本 · 滾輪或雙指縮放。各選手位置亦列於「本場選手」。",
        )}
      </p>
    </section>
  );
}
