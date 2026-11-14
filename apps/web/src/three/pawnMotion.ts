/**
 * Timing and poses for pawn animation on the 3D board. Pure maths only: no
 * three.js and no clocks, so every pose can be unit-tested from elapsed time.
 * Heights are in pawn-local units (the pawn group is scaled up afterwards).
 */

/** The slice of a playback frame the 3D board reacts to. */
export interface PlaybackCue {
  event: { type: string; racerId?: string; id?: number };
  movingIds?: readonly string[];
}

export type TravelKind = "hop" | "warp" | "glide";

export const HOP_MS = 165;
export const LANDING_MS = 110;
export const HOP_HEIGHT = 0.34;
export const WARP_MS = 440;
export const FALL_MS = 460;
export const RISE_MS = 320;
export const CHEER_MS = 900;
export const CONFETTI_MS = 1400;
export const CONFETTI_COLOURS = 5;

const LANDING_SQUASH = 0.16;
const WARP_FOLD_SHARE = 0.42;
const MIN_FOLD = 0.02;
const CHEER_HEIGHT = 0.62;
const CHEER_FIRST_JUMP = 0.6;
const CONFETTI_START_HEIGHT = 0.55;
const CONFETTI_GRAVITY = 7;
const CONFETTI_REST_HEIGHT = 0.02;
const CONFETTI_FADE_FROM = 0.7;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function easeOutBack(t: number): number {
  const overshoot = 1.70158;
  const shifted = t - 1;
  return (
    1 +
    (overshoot + 1) * shifted * shifted * shifted +
    overshoot * shifted * shifted
  );
}

function easeOutBounce(t: number): number {
  const strength = 7.5625;
  const span = 2.75;
  if (t < 1 / span) return strength * t * t;
  if (t < 2 / span) {
    const shifted = t - 1.5 / span;
    return strength * shifted * shifted + 0.75;
  }
  if (t < 2.5 / span) {
    const shifted = t - 2.25 / span;
    return strength * shifted * shifted + 0.9375;
  }
  const shifted = t - 2.625 / span;
  return strength * shifted * shifted + 0.984375;
}

const easeInOut = (t: number) => t * t * (3 - 2 * t);

/**
 * Pawns named by the playback frame hop (or fold away for a warp). Everyone
 * else only glides, which covers making room on a shared space.
 */
export function travelKind(pawnId: string, cue?: PlaybackCue): TravelKind {
  if (!cue?.movingIds?.includes(pawnId)) return "glide";
  return cue.event.type === "WARP" ? "warp" : "hop";
}

export interface TravelPose {
  /** 0 at the old spot, 1 at the new one. */
  travel: number;
  /** Height above the tile. */
  lift: number;
  /** Vertical squash on landing; 1 is the resting shape. */
  squash: number;
  /** Vertical scale while folding into the page; 1 is fully popped up. */
  fold: number;
  done: boolean;
}

/** One hop to the next spot: an arc, then a short squash as it lands. */
export function hopPose(elapsedMs: number): TravelPose {
  const flight = clamp01(elapsedMs / HOP_MS);
  const landing = clamp01((elapsedMs - HOP_MS) / LANDING_MS);
  return {
    travel: flight,
    lift: HOP_HEIGHT * 4 * flight * (1 - flight),
    squash: 1 - LANDING_SQUASH * Math.sin(Math.PI * landing),
    fold: 1,
    done: elapsedMs >= HOP_MS + LANDING_MS,
  };
}

/** A warp folds the pawn flat into the page, then pops it up at the new spot. */
export function warpPose(elapsedMs: number): TravelPose {
  const progress = clamp01(elapsedMs / WARP_MS);
  if (progress < WARP_FOLD_SHARE) {
    const folding = progress / WARP_FOLD_SHARE;
    return {
      travel: 0,
      lift: 0,
      squash: 1,
      fold: Math.max(MIN_FOLD, 1 - folding * folding),
      done: false,
    };
  }
  const popping = (progress - WARP_FOLD_SHARE) / (1 - WARP_FOLD_SHARE);
  return {
    travel: 1,
    lift: 0,
    squash: 1,
    fold: Math.max(MIN_FOLD, easeOutBack(popping)),
    done: progress >= 1,
  };
}

/**
 * How far over the pawn is: 0 upright, 1 flat on its side. Falling bounces,
 * getting up overshoots slightly, and either can start from a half-way pose.
 */
export function fallAmount(
  elapsedMs: number,
  from: number,
  to: number,
): number {
  if (from === to) return to;
  const falling = to > from;
  const progress = clamp01(elapsedMs / (falling ? FALL_MS : RISE_MS));
  const eased = falling ? easeOutBounce(progress) : easeOutBack(progress);
  return from + (to - from) * eased;
}

export interface CheerPose {
  lift: number;
  /** Rotation about the vertical axis, in radians. */
  turn: number;
  done: boolean;
}

/** Crossing the line: a big spinning jump, then a smaller one. */
export function cheerPose(elapsedMs: number): CheerPose {
  const progress = clamp01(elapsedMs / CHEER_MS);
  const first = progress < CHEER_FIRST_JUMP;
  const jump = first
    ? progress / CHEER_FIRST_JUMP
    : (progress - CHEER_FIRST_JUMP) / (1 - CHEER_FIRST_JUMP);
  const height = first ? CHEER_HEIGHT : CHEER_HEIGHT * 0.45;
  return {
    lift: height * 4 * jump * (1 - jump),
    turn: Math.PI * 2 * (first ? easeInOut(jump) : 1),
    done: progress >= 1,
  };
}

export interface ConfettiPiece {
  /** Launch velocity in units per second. */
  vx: number;
  vy: number;
  vz: number;
  /** Tumble speed in radians per second. */
  spinX: number;
  spinZ: number;
  /** Index into the confetti colour list. */
  colour: number;
  size: number;
}

/** Repeatable pseudo-random number in [0, 1); visuals never use Math.random. */
function scatter(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** One scrap of paper in a burst. The same seed always gives the same burst. */
export function confettiPiece(index: number, seed: number): ConfettiPiece {
  const angle = scatter(index, seed) * Math.PI * 2;
  const speed = 0.6 + scatter(index, seed + 1) * 1.3;
  return {
    vx: Math.cos(angle) * speed,
    vy: 2.3 + scatter(index, seed + 2) * 2,
    vz: Math.sin(angle) * speed,
    spinX: 4 + scatter(index, seed + 3) * 9,
    spinZ: 3 + scatter(index, seed + 4) * 8,
    colour: Math.floor(scatter(index, seed + 5) * CONFETTI_COLOURS),
    size: 0.07 + scatter(index, seed + 6) * 0.06,
  };
}

export interface ConfettiPose {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationZ: number;
  scale: number;
}

/** Where a scrap is, relative to the burst: up, out, then resting on the page. */
export function confettiPose(
  piece: ConfettiPiece,
  elapsedMs: number,
): ConfettiPose {
  const seconds = Math.max(0, elapsedMs) / 1000;
  const drop = CONFETTI_START_HEIGHT - CONFETTI_REST_HEIGHT;
  const landing =
    (piece.vy + Math.sqrt(piece.vy * piece.vy + 2 * CONFETTI_GRAVITY * drop)) /
    CONFETTI_GRAVITY;
  const airborne = Math.min(seconds, landing);
  const progress = clamp01(elapsedMs / CONFETTI_MS);
  return {
    x: piece.vx * airborne,
    y: Math.max(
      CONFETTI_REST_HEIGHT,
      CONFETTI_START_HEIGHT +
        piece.vy * airborne -
        (CONFETTI_GRAVITY * airborne * airborne) / 2,
    ),
    z: piece.vz * airborne,
    rotationX: piece.spinX * airborne,
    rotationZ: piece.spinZ * airborne,
    scale:
      1 - clamp01((progress - CONFETTI_FADE_FROM) / (1 - CONFETTI_FADE_FROM)),
  };
}

/**
 * The pawn the camera should watch: whoever is moving, else the racer the
 * current event is about, else the racer whose turn it is.
 */
export function focusPawn<Pawn extends { id: string; active: boolean }>(
  pawns: readonly Pawn[],
  cue?: PlaybackCue,
): Pawn | undefined {
  const movingId = cue?.movingIds?.[0];
  return (
    pawns.find((pawn) => pawn.id === movingId) ??
    pawns.find((pawn) => pawn.id === cue?.event.racerId) ??
    pawns.find((pawn) => pawn.active)
  );
}
