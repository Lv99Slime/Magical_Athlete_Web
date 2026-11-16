import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { TRACKS } from "@magical/engine";
import { useI18n } from "../i18n";
import { supportsWebGL } from "../webgl";
import { boardPawns, type PawnSource } from "./boardPawns";
import { PaperDie } from "./PaperDie";
import { PaperPawns } from "./PaperPawns";
import { focusPawn, type PlaybackCue } from "./pawnMotion";
import {
  bookSize,
  CameraRig,
  FIELD_OF_VIEW,
  PaperStage,
  useReducedMotion,
  type StageTrack,
} from "./PaperStage";
import { LAST_POSITION } from "./trackLayout3d";

type SampleRacer = PawnSource["racers"][number];

/** Fixed showcase: one active pawn, two sharing a space and one tripped. */
const SAMPLE: PawnSource = {
  players: [{ id: "p0" }, { id: "p1" }, { id: "p2" }, { id: "p3" }],
  turn: { racerId: "magician" },
  racers: [
    { id: "magician", ownerId: "p0", racerId: "magician", position: 11 },
    { id: "huge_baby", ownerId: "p1", racerId: "huge_baby", position: 13 },
    { id: "banana", ownerId: "p2", racerId: "banana", position: 13 },
    { id: "suckerfish", ownerId: "p3", racerId: "suckerfish", position: 9 },
  ].map((racer) => ({
    ...racer,
    status: "active",
    tripped: racer.id === "suckerfish",
  })),
};
const SAMPLE_DIE = 5;
// Same pacing as the real playback frames in racePlayback.ts.
const STEP_MS = 180;
const WARP_FRAME_MS = 480;
const TRIP_FRAME_MS = 480;
const FINISH_FRAME_MS = 650;
const POWER_FRAME_MS = 750;
const ELIMINATED_FRAME_MS = 480;
const ROLLING_FRAME_MS = 650;
const RESULT_FRAME_MS = 550;
const HOP_STEPS = 5;
const WARP_SPACES = 9;
const FINISH_RUN_UP = 3;

/** The sample die. Demo rolls cycle through the faces; nothing here is random. */
interface LabDie {
  face: number;
  rolling: boolean;
  rollId: number;
}

interface LabScene {
  source: PawnSource;
  cue?: PlaybackCue;
  die: LabDie;
  /** Bumped to replay the book opening. */
  opening: number;
  /** How many demos have played to the end; lets tests wait without racing. */
  played: number;
}

/** One beat of a demo: optional changes to the sample, shown for `wait` ms. */
interface DemoStep {
  wait: number;
  change?: (source: PawnSource) => PawnSource;
  cue?: PlaybackCue;
  die?: Partial<LabDie>;
}

const racerIn = (source: PawnSource, id: string): SampleRacer =>
  source.racers.find((racer) => racer.id === id) ?? source.racers[0];

const withRacer =
  (id: string, change: (racer: SampleRacer) => Partial<SampleRacer>) =>
  (source: PawnSource): PawnSource => ({
    ...source,
    racers: source.racers.map((racer) =>
      racer.id === id ? { ...racer, ...change(racer) } : racer,
    ),
  });

const cueFor = (type: string, racerId: string, id: number): PlaybackCue => ({
  event: { type, racerId, id },
  movingIds: type === "MOVE" || type === "WARP" ? [racerId] : undefined,
});

/** Scripted stand-ins for playback frames, so each animation can be watched. */
function demoSteps(name: string, eventId: number): DemoStep[] {
  const forward = (racer: SampleRacer) => ({
    position: Math.min(LAST_POSITION, racer.position + 1),
  });
  if (name === "hop")
    return Array.from({ length: HOP_STEPS }, () => ({
      wait: STEP_MS,
      change: withRacer("magician", forward),
      cue: cueFor("MOVE", "magician", eventId),
    }));
  if (name === "warp")
    return [
      {
        wait: WARP_FRAME_MS,
        change: withRacer("banana", (racer) => ({
          position: (racer.position + WARP_SPACES) % LAST_POSITION,
        })),
        cue: cueFor("WARP", "banana", eventId),
      },
    ];
  if (name === "trip")
    return [
      {
        wait: TRIP_FRAME_MS,
        change: withRacer("magician", (racer) => ({
          tripped: !racer.tripped,
        })),
        cue: cueFor("RACER_TRIPPED", "magician", eventId),
      },
    ];
  if (name === "roll")
    return [
      { wait: ROLLING_FRAME_MS, die: { rolling: true, rollId: eventId } },
      {
        wait: RESULT_FRAME_MS,
        die: { rolling: false, face: (eventId % 6) + 1 },
      },
    ];
  if (name === "out")
    return [
      {
        wait: ELIMINATED_FRAME_MS,
        change: withRacer("banana", () => ({ status: "eliminated" })),
        cue: cueFor("RACER_ELIMINATED", "banana", eventId),
      },
    ];
  if (name === "power")
    return [
      {
        wait: POWER_FRAME_MS,
        cue: cueFor("POWER_TRIGGERED", "magician", eventId),
      },
    ];
  return [
    {
      wait: 600,
      change: withRacer("huge_baby", () => ({
        position: LAST_POSITION - FINISH_RUN_UP,
        status: "active",
      })),
    },
    ...Array.from({ length: FINISH_RUN_UP }, () => ({
      wait: STEP_MS,
      change: withRacer("huge_baby", forward),
      cue: cueFor("MOVE", "huge_baby", eventId),
    })),
    {
      wait: FINISH_FRAME_MS,
      change: withRacer("huge_baby", () => ({ status: "finished" })),
      cue: cueFor("FINISH", "huge_baby", eventId),
    },
  ];
}

const START_SCENE: LabScene = {
  source: SAMPLE,
  die: { face: SAMPLE_DIE, rolling: false, rollId: 0 },
  opening: 1,
  played: 0,
};

function SampleScene({ scene, still }: { scene: LabScene; still: boolean }) {
  const track = TRACKS.find(
    (candidate: { id: string }) => candidate.id === "wild_wilds",
  ) as StageTrack;
  const size = useMemo(bookSize, []);
  const pawns = useMemo(() => boardPawns(scene.source), [scene.source]);
  return (
    <>
      <PaperStage track={track} opening={still ? undefined : scene.opening}>
        <PaperPawns pawns={pawns} cue={scene.cue} still={still} />
        <PaperDie
          value={scene.die.rolling ? undefined : scene.die.face}
          position={[5.3, 0.31, 0.45]}
          spin={0.5}
          rolling={scene.die.rolling}
          rollId={scene.die.rollId}
          still={still}
        />
      </PaperStage>
      <CameraRig
        size={size}
        focus={scene.cue ? focusPawn(pawns, scene.cue) : undefined}
        tracking={scene.cue !== undefined}
        still={still}
      />
    </>
  );
}

/** Style and animation sample for the pop-up paper book. Not wired to game state. */
export default function PaperLab() {
  const { t } = useI18n();
  const still = useReducedMotion();
  const [webgl] = useState(supportsWebGL);
  const [scene, setScene] = useState<LabScene>(START_SCENE);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const eventId = useRef(0);
  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => stop, []);
  const play = (name: string) => {
    stop();
    eventId.current += 1;
    let delay = 0;
    for (const step of demoSteps(name, eventId.current)) {
      timers.current.push(
        setTimeout(
          () =>
            setScene((shown) => ({
              ...shown,
              source: step.change ? step.change(shown.source) : shown.source,
              cue: step.cue,
              die: { ...shown.die, ...step.die },
            })),
          delay,
        ),
      );
      delay += step.wait;
    }
    timers.current.push(
      setTimeout(
        () =>
          setScene((shown) => ({
            ...shown,
            cue: undefined,
            played: shown.played + 1,
          })),
        delay,
      ),
    );
  };
  const reset = () => {
    stop();
    setScene((shown) => ({
      ...START_SCENE,
      opening: shown.opening,
      played: shown.played,
    }));
  };
  const reopen = () => {
    stop();
    setScene((shown) => ({
      ...shown,
      cue: undefined,
      die: { ...shown.die, rolling: false },
      opening: shown.opening + 1,
    }));
  };
  const finished = racerIn(scene.source, "huge_baby").status === "finished";
  const demos: [string, string][] = [
    ["roll", t("Roll", "擲骰")],
    ["hop", t("Hop", "跳格")],
    ["warp", t("Warp", "傳送")],
    ["trip", t("Trip", "絆倒")],
    ["power", t("Power", "能力")],
    ["out", t("Out", "淘汰")],
    ["finish", t("Finish", "衝線")],
  ];
  return (
    <div className="paper-lab">
      {webgl ? (
        <Canvas
          flat
          shadows
          dpr={[1, 2]}
          camera={{ fov: FIELD_OF_VIEW, near: 0.5, far: 120 }}
        >
          <Suspense fallback={null}>
            <SampleScene scene={scene} still={still} />
          </Suspense>
        </Canvas>
      ) : (
        <p className="paper-lab-fallback" role="status">
          {t(
            "This device cannot show the 3D board. The 2D board still works.",
            "此裝置未能顯示 3D 棋盤，你仍可使用 2D 棋盤。",
          )}
        </p>
      )}
      <div className="paper-lab-caption">
        <span className="race-stamp">
          {t("3D style sample", "3D 風格樣板")}
        </span>
        <strong>{t("Pop-up paper book", "立體紙藝書")}</strong>
        <small>
          {t(
            "Drag to look around · scroll or pinch to zoom",
            "拖曳轉動視角 · 滾輪或雙指縮放",
          )}
        </small>
        <a className="quiet" href={location.pathname}>
          {t("Back to the game", "返回遊戲")}
        </a>
        {webgl && (
          <div
            className="paper-lab-demo"
            role="group"
            aria-label={t("Animation demo", "動畫示範")}
            data-demo-played={scene.played}
            data-demo-finished={finished ? "true" : "false"}
            data-demo-face={scene.die.rolling ? "rolling" : scene.die.face}
            data-demo-opening={scene.opening}
          >
            {demos.map(([name, label]) => (
              <button key={name} className="quiet" onClick={() => play(name)}>
                {label}
              </button>
            ))}
            <button className="quiet" onClick={reopen}>
              {t("Open book", "揭書")}
            </button>
            <button className="quiet" onClick={reset}>
              {t("Reset", "重設")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
