import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Canvas } from "@react-three/fiber";
import { SCHEDULE, TRACKS } from "@magical/engine";
import type { PlayerView } from "@magical/engine";
import type { DiceDisplay } from "../dicePresentation";
import { useI18n } from "../i18n";
import type { PlaybackFrame } from "../racePlayback";
import { diceForThisRace } from "../TurnConsole";
import { boardPawns } from "./boardPawns";
import { START_VERDICT, type FrameVerdict, type Quality } from "./frameBudget";
import { FrameWatch } from "./FrameWatch";
import { PaperDie } from "./PaperDie";
import { PaperPawns } from "./PaperPawns";
import { focusPawn } from "./pawnMotion";
import {
  bookSize,
  CameraRig,
  FIELD_OF_VIEW,
  PaperStage,
  useCoarsePointer,
  useReducedMotion,
  type StageTrack,
} from "./PaperStage";

const DIE_REST: [number, number, number] = [5.3, 0.31, 0.45];
/** Pixel-ratio range per quality; low quality also halves the shadow map. */
const PIXEL_RATIO: Record<Quality, [number, number]> = {
  high: [1, 2],
  low: [1, 1.25],
};
/**
 * The last board that was shown. Pass-and-play remounts the board at every
 * hand-off, and the book opening should play once per race, not each time. A
 * lower version than the one remembered means a new game has started.
 */
let lastShown: { race: number; version: number } | undefined;
/**
 * Quality only steps down, and a remounted board keeps what was learned,
 * including how many slow stretches it has already counted.
 */
let remembered: FrameVerdict = START_VERDICT;

export interface PaperBoard3DProps {
  view: PlayerView;
  dice?: DiceDisplay;
  /** The playback frame on show; it only chooses how pawns and camera move. */
  playback?: PlaybackFrame;
  /** Fast mode: no idle motion, and frames are drawn only when something changes. */
  still?: boolean;
  /** Called when the device cannot keep up even on low quality. */
  onTooSlow?: () => void;
}

/** What the paper die should show: the roll from the engine, never its own. */
interface ShownDie {
  /** Unknown while the roll is still being played back. */
  face?: number;
  rolling: boolean;
  rollId: number;
}

/** True while the element is at least partly on screen. */
function useInView<Target extends Element>(): [
  RefObject<Target | null>,
  boolean,
] {
  const target = useRef<Target>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const element = target.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [target, inView];
}

function BoardScene({
  view,
  die,
  track,
  still,
  playback,
  opening,
  quality,
}: {
  view: PlayerView;
  playback?: PlaybackFrame;
  die?: ShownDie;
  opening?: number;
  track: StageTrack;
  still: boolean;
  quality: Quality;
}) {
  const size = useMemo(bookSize, []);
  const pawns = useMemo(() => boardPawns(view), [view]);
  const focus = focusPawn(pawns, playback);
  return (
    <>
      <PaperStage track={track} opening={opening} quality={quality}>
        <PaperPawns pawns={pawns} cue={playback} still={still} />
        {die && (
          <PaperDie
            value={die.face}
            position={DIE_REST}
            spin={(die.rollId % 7) * 0.45}
            rolling={die.rolling}
            rollId={die.rollId}
            still={still}
          />
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
  onTooSlow,
}: PaperBoard3DProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const touch = useCoarsePointer();
  const calm = still || reducedMotion;
  const [canvasBox, inView] = useInView<HTMLDivElement>();
  const [quality, setQuality] = useState<Quality>(remembered.quality);
  const judge = (verdict: FrameVerdict) => {
    // After giving up, a later retry starts again on low quality.
    remembered = verdict.tooSlow
      ? { quality: "low", slowWindows: 0, tooSlow: false }
      : verdict;
    setQuality(verdict.quality);
    if (verdict.tooSlow) onTooSlow?.();
  };
  const schedule = SCHEDULE[Math.max(0, view.raceNumber - 1)];
  const track = TRACKS.find(
    (candidate: { id: string }) => candidate.id === schedule.trackId,
  ) as StageTrack;
  const trackLabel = t(
    track.name,
    track.id === "mild_mile" ? "悠閒一哩 · Mild Mile" : "狂野荒野 · Wild Wilds",
  );
  const shown = diceForThisRace(view, dice);
  const rolling = !calm && shown?.phase === "rolling";
  const die: ShownDie | undefined =
    shown && (rolling || shown.phase === "result")
      ? {
          face: rolling ? undefined : (shown.event.data?.face as number),
          rolling,
          rollId: shown.event.id,
        }
      : undefined;
  // One-shot: decided when the board mounts and dropped for good as soon as
  // motion is switched off, so toggling fast mode never replays it.
  const [opening, setOpening] = useState(() => {
    const seen =
      lastShown !== undefined &&
      lastShown.race === view.raceNumber &&
      view.version >= lastShown.version;
    return calm || seen ? undefined : 1;
  });
  if (calm && opening !== undefined) setOpening(undefined);
  useEffect(() => {
    lastShown = { race: view.raceNumber, version: view.version };
  }, [view.raceNumber, view.version]);
  return (
    <section
      className="board-panel board-panel-3d"
      data-board="3d"
      data-quality={quality}
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
      <div className="board-canvas" ref={canvasBox}>
        <Canvas
          flat
          shadows
          dpr={PIXEL_RATIO[quality]}
          // Nothing is drawn while the board is scrolled out of sight.
          frameloop={calm ? "demand" : inView ? "always" : "never"}
          camera={{ fov: FIELD_OF_VIEW, near: 0.5, far: 120 }}
        >
          <Suspense fallback={null}>
            <BoardScene
              view={view}
              die={die}
              opening={opening}
              track={track}
              still={calm}
              playback={calm ? undefined : playback}
              quality={quality}
            />
            <FrameWatch
              active={!calm && inView}
              start={remembered}
              onVerdict={judge}
            />
          </Suspense>
        </Canvas>
      </div>
      <p className="board-caption">
        {touch
          ? t(
              "One finger scrolls the page · two fingers zoom and turn the book. Positions are also listed under This race.",
              "單指捲動頁面 · 雙指縮放及轉動書本。各選手位置亦列於「本場選手」。",
            )
          : t(
              "Drag to turn the book · scroll or pinch to zoom. Positions are also listed under This race.",
              "拖曳轉動書本 · 滾輪或雙指縮放。各選手位置亦列於「本場選手」。",
            )}
      </p>
    </section>
  );
}
