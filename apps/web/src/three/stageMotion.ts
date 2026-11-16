/**
 * Timing and poses for the stage itself: the rolling die, the power spotlight
 * and the book opening. Pure maths only, like pawnMotion.ts. The die pose never
 * decides a result: it only tumbles until the engine's face is shown.
 */
import { clamp01, easeOutBack, scatter } from "./pawnMotion";

export const ROLL_MS = 600;
export const SETTLE_MS = 300;
export const SPOTLIGHT_MS = 750;
export const BOOK_OPEN_MS = 800;
export const POP_MS = 420;

const ROLL_BOUNCES = 3;
const ROLL_ARC = 1.1;
const ROLL_HOVER = 0.28;
const SETTLE_HOP = 0.1;
const SPOTLIGHT_IN_MS = 180;
const SPOTLIGHT_OUT_MS = 150;
const SPOTLIGHT_TURN_RATE = 0.9;

export interface TumblePose {
  /** Offset from the resting spot. */
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

/**
 * The die in the air: thrown in from the side, bouncing towards its resting
 * spot and spinning. The same roll id always gives the same throw. It keeps
 * hovering and turning for as long as the result is not shown yet.
 */
export function tumblePose(elapsedMs: number, seed: number): TumblePose {
  const elapsed = Math.max(0, elapsedMs);
  const progress = clamp01(elapsed / ROLL_MS);
  const away = (1 - progress) * (1 - progress);
  const seconds = elapsed / 1000;
  return {
    x: (1.5 + scatter(seed, 1) * 0.7) * away,
    y:
      ROLL_HOVER +
      Math.abs(Math.sin(Math.PI * ROLL_BOUNCES * progress)) *
        ROLL_ARC *
        (1 - 0.6 * progress),
    z: (0.5 + scatter(seed, 2) * 0.7) * away,
    rotationX: (9 + scatter(seed, 3) * 5) * seconds,
    rotationY: (4 + scatter(seed, 4) * 4) * seconds,
    rotationZ: (7 + scatter(seed, 5) * 5) * seconds,
  };
}

export interface SettlePose {
  /** 0 keeps the tumbling pose, 1 is the resting pose with the result on top. */
  blend: number;
  /** A last small hop as it comes to rest. */
  hop: number;
  done: boolean;
}

/** The die coming to rest once the engine's result is shown. */
export function settlePose(elapsedMs: number): SettlePose {
  const progress = clamp01(elapsedMs / SETTLE_MS);
  const left = 1 - progress;
  return {
    blend: 1 - left * left * left,
    hop: SETTLE_HOP * Math.sin(Math.PI * progress),
    done: progress >= 1,
  };
}

export interface SpotlightPose {
  scale: number;
  /** Rotation of the burst on the page, in radians. */
  turn: number;
  done: boolean;
}

/** The paper burst under a pawn whose power goes off: pop in, hold, shrink away. */
export function spotlightPose(elapsedMs: number): SpotlightPose {
  const elapsed = Math.min(SPOTLIGHT_MS, Math.max(0, elapsedMs));
  const leaving =
    (elapsed - (SPOTLIGHT_MS - SPOTLIGHT_OUT_MS)) / SPOTLIGHT_OUT_MS;
  const scale =
    elapsed < SPOTLIGHT_IN_MS
      ? Math.max(0, easeOutBack(elapsed / SPOTLIGHT_IN_MS))
      : leaving > 0
        ? Math.max(0, 1 - leaving * leaving)
        : 1;
  return {
    scale,
    turn: (elapsed / 1000) * SPOTLIGHT_TURN_RATE,
    done: elapsed >= SPOTLIGHT_MS,
  };
}

/** How far the standing page has swung up: 0 half shut, 1 fully open. */
export function bookOpenAmount(elapsedMs: number): number {
  const left = 1 - clamp01(elapsedMs / BOOK_OPEN_MS);
  return 1 - left * left * left;
}

/**
 * How far a pop-up layer has risen: 0 flat until its `delayMs`, then a springy
 * rise that overshoots a little before resting at 1.
 */
export function popUpAmount(
  elapsedMs: number,
  delayMs: number,
  durationMs: number = POP_MS,
): number {
  const progress = clamp01((elapsedMs - delayMs) / durationMs);
  return progress <= 0 ? 0 : easeOutBack(progress);
}
