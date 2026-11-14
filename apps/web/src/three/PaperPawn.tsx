import { useEffect, useMemo, useRef } from "react";
import { Outlines, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RACERS } from "@magical/engine";
import { PAPER } from "./paperTheme";
import {
  cheerPose,
  fallAmount,
  hopPose,
  warpPose,
  type TravelKind,
} from "./pawnMotion";
import { TILE_HEIGHT } from "./trackLayout3d";

export interface PawnProps {
  racerId: string;
  colour: string;
  /** Centre of the pawn's standing spot on the page. */
  x: number;
  z: number;
  active?: boolean;
  tripped?: boolean;
  /** Reduced-motion and fast modes: no idle bob, and every change snaps. */
  still?: boolean;
  /** Extra pole steps so flags on a shared space stay readable. */
  tier?: number;
  /** How the pawn reaches a new spot; gliding when not told otherwise. */
  travel?: TravelKind;
  /** Set to a new number when this pawn crosses the line, to celebrate once. */
  cheer?: number;
}

const BASE_RADIUS = 0.2;
const BASE_HEIGHT = 0.07;
const BODY_HEIGHT = 0.34;
const FLAG_SIZE = 0.5;
const FLAG_BORDER = 0.045;
const POLE_HEIGHT = 0.16;
const TIER_HEIGHT = 0.3;
const PAWN_SCALE = 1.65;
const GLIDE_RATE = 14;
const GLIDE_ARRIVED = 0.002;
const IDLE_BOB = 0.09;
const BOB_EASE_RATE = 6;
/** Where the body and flag come to rest when the pawn is tripped. */
const BODY_FALLEN = { x: -0.18, y: BASE_RADIUS, z: 0.1, turn: 0.35 };
const FLAG_FALLEN = { x: 0.16, y: 0.03, z: -0.06, twist: -0.28 };
const POLE_HIDDEN_BEYOND = 0.35;
const SHEET_COLUMNS = 3;
const SHEET_ROWS = 2;

/** Same six 3x2 sprite sheets as the 2D RacerArt, cropped with texture offsets. */
function usePortrait(racerId: string): THREE.Texture {
  const index = Math.max(
    0,
    RACERS.findIndex((racer: { id: string }) => racer.id === racerId),
  );
  const sheet = useTexture(
    `${import.meta.env.BASE_URL}art/racers-${Math.floor(index / 6)}.webp`,
  );
  const portrait = useMemo(() => {
    const cell = index % 6;
    const cropped = sheet.clone();
    cropped.colorSpace = THREE.SRGBColorSpace;
    cropped.repeat.set(1 / SHEET_COLUMNS, 1 / SHEET_ROWS);
    cropped.offset.set(
      (cell % SHEET_COLUMNS) / SHEET_COLUMNS,
      1 - (Math.floor(cell / SHEET_COLUMNS) + 1) / SHEET_ROWS,
    );
    cropped.anisotropy = 8;
    cropped.needsUpdate = true;
    return cropped;
  }, [sheet, index]);
  useEffect(() => () => portrait.dispose(), [portrait]);
  return portrait;
}

/** The racer's printed paper flag: a bordered portrait card. */
function PortraitFlag({ portrait }: { portrait: THREE.Texture }) {
  const outer = FLAG_SIZE + FLAG_BORDER * 2;
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[outer, outer, 0.025]} />
        <meshStandardMaterial color={PAPER.white} roughness={1} />
        <Outlines screenspace thickness={0.018} color={PAPER.ink} />
      </mesh>
      <mesh position={[0, 0, 0.014]}>
        <planeGeometry args={[FLAG_SIZE, FLAG_SIZE]} />
        <meshBasicMaterial map={portrait} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PawnBody({ colour }: { colour: string }) {
  return (
    <group>
      <mesh position={[0, BASE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS, BASE_HEIGHT, 28]} />
        <meshStandardMaterial color={colour} roughness={1} />
        <Outlines screenspace thickness={0.018} color={PAPER.ink} />
      </mesh>
      <mesh position={[0, BASE_HEIGHT + BODY_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.15, BODY_HEIGHT, 6]} />
        <meshStandardMaterial color={colour} roughness={1} flatShading />
        <Outlines screenspace thickness={0.018} color={PAPER.ink} />
      </mesh>
    </group>
  );
}

/** Animation bookkeeping kept between frames; never read while rendering. */
interface PawnState {
  ready: boolean;
  x: number;
  z: number;
  travel?: { kind: TravelKind; fromX: number; fromZ: number; start: number };
  fall: number;
  fallFrom: number;
  fallTo: number;
  fallStart: number;
  cheer?: number;
  cheerStart?: number;
  /** 0 to 1 weight of the idle bob, eased so it never pops in after a hop. */
  bob: number;
}

export function PaperPawn({
  racerId,
  colour,
  x,
  z,
  active = false,
  tripped = false,
  still = false,
  tier = 0,
  travel = "glide",
  cheer,
}: PawnProps) {
  const portrait = usePortrait(racerId);
  const root = useRef<THREE.Group>(null);
  const figure = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const flag = useRef<THREE.Group>(null);
  const poleMesh = useRef<THREE.Mesh>(null);
  const motion = useRef<PawnState>({
    ready: false,
    x,
    z,
    fall: 0,
    fallFrom: 0,
    fallTo: 0,
    fallStart: 0,
    bob: 0,
  });
  const invalidate = useThree((state) => state.invalidate);
  // Ask for a frame when the pose changes; needed when frames are drawn on demand.
  useEffect(() => {
    invalidate();
  }, [x, z, tripped, still, invalidate]);
  const pole = POLE_HEIGHT + tier * TIER_HEIGHT;
  const flagCentre =
    BASE_HEIGHT + BODY_HEIGHT + pole + FLAG_SIZE / 2 + FLAG_BORDER;
  useFrame(({ clock, camera }, delta) => {
    const group = root.current;
    if (
      !group ||
      !figure.current ||
      !body.current ||
      !flag.current ||
      !poleMesh.current
    )
      return;
    const now = clock.elapsedTime * 1000;
    const state = motion.current;
    const fallTarget = tripped ? 1 : 0;
    const snap = still || !state.ready;

    // Travel: hop or fold for playback moves, glide when making room.
    if (snap) {
      group.position.set(x, TILE_HEIGHT, z);
      state.travel = undefined;
    } else if (x !== state.x || z !== state.z) {
      state.travel = {
        kind: travel,
        fromX: group.position.x,
        fromZ: group.position.z,
        start: now,
      };
    }
    state.x = x;
    state.z = z;
    let lift = 0;
    let squash = 1;
    let fold = 1;
    const journey = state.travel;
    if (journey?.kind === "glide") {
      const ease = 1 - Math.exp(-Math.min(delta, 0.1) * GLIDE_RATE);
      group.position.x += (x - group.position.x) * ease;
      group.position.z += (z - group.position.z) * ease;
      const left =
        Math.abs(x - group.position.x) + Math.abs(z - group.position.z);
      if (left < GLIDE_ARRIVED) {
        group.position.set(x, TILE_HEIGHT, z);
        state.travel = undefined;
      }
    } else if (journey) {
      const elapsed = now - journey.start;
      const pose =
        journey.kind === "warp" ? warpPose(elapsed) : hopPose(elapsed);
      group.position.x = journey.fromX + (x - journey.fromX) * pose.travel;
      group.position.z = journey.fromZ + (z - journey.fromZ) * pose.travel;
      lift = pose.lift;
      squash = pose.squash;
      fold = pose.fold;
      if (pose.done) state.travel = undefined;
    }

    // Tripping over and getting back up.
    if (snap) {
      state.fallFrom = fallTarget;
      state.fallTo = fallTarget;
    } else if (fallTarget !== state.fallTo) {
      state.fallFrom = state.fall;
      state.fallTo = fallTarget;
      state.fallStart = now;
    }
    state.fall = fallAmount(
      now - state.fallStart,
      state.fallFrom,
      state.fallTo,
    );
    const fall = state.fall;

    // Crossing the line.
    if (cheer !== state.cheer) {
      state.cheer = cheer;
      if (cheer !== undefined && !snap) state.cheerStart = now;
    }
    if (still) state.cheerStart = undefined;
    let turn = 0;
    if (state.cheerStart !== undefined) {
      const pose = cheerPose(now - state.cheerStart);
      lift += pose.lift;
      turn = pose.turn;
      if (pose.done) state.cheerStart = undefined;
    }
    state.ready = true;

    const resting =
      !state.travel && state.cheerStart === undefined && fallTarget === 0;
    const bobGoal = active && !still && resting ? 1 : 0;
    state.bob = still
      ? 0
      : state.bob +
        (bobGoal - state.bob) *
          (1 - Math.exp(-Math.min(delta, 0.1) * BOB_EASE_RATE));
    lift += Math.abs(Math.sin(clock.elapsedTime * 3.2)) * IDLE_BOB * state.bob;

    const spread = 1 + (1 - squash) * 0.5;
    figure.current.position.y = lift;
    figure.current.rotation.y = turn;
    figure.current.scale.set(spread, squash * fold, spread);
    body.current.position.set(
      BODY_FALLEN.x * fall,
      BODY_FALLEN.y * fall,
      BODY_FALLEN.z * fall,
    );
    body.current.rotation.set(0, BODY_FALLEN.turn * fall, (Math.PI / 2) * fall);
    poleMesh.current.visible = fall < POLE_HIDDEN_BEYOND;
    // The flag faces the camera while standing and lies face-up once fallen.
    const facing =
      Math.atan2(
        camera.position.x - group.position.x,
        camera.position.z - group.position.z,
      ) - turn;
    flag.current.position.set(
      FLAG_FALLEN.x * fall,
      flagCentre + (FLAG_FALLEN.y - flagCentre) * fall,
      FLAG_FALLEN.z * fall,
    );
    flag.current.rotation.set(
      (-Math.PI / 2) * fall,
      facing * (1 - fall),
      FLAG_FALLEN.twist * fall,
    );
  });
  return (
    <group ref={root} scale={PAWN_SCALE}>
      {active && !tripped && (
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[BASE_RADIUS + 0.05, BASE_RADIUS + 0.13, 40]} />
          <meshBasicMaterial color={PAPER.ink} toneMapped={false} />
        </mesh>
      )}
      <group ref={figure}>
        <group ref={body}>
          <PawnBody colour={colour} />
        </group>
        <mesh
          ref={poleMesh}
          position={[0, BASE_HEIGHT + BODY_HEIGHT + pole / 2, 0]}
        >
          <cylinderGeometry args={[0.018, 0.018, pole + 0.04, 8]} />
          <meshStandardMaterial color={PAPER.ink} roughness={1} />
        </mesh>
        <group ref={flag} position={[0, flagCentre, 0]}>
          <PortraitFlag portrait={portrait} />
        </group>
      </group>
    </group>
  );
}
