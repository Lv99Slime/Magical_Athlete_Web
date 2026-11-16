import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  GRACE_MS,
  judgeWindow,
  PAUSE_GAP_MS,
  WINDOW_MS,
  windowFps,
  type FrameVerdict,
} from "./frameBudget";

/** Measuring bookkeeping kept between frames; never read while rendering. */
interface WatchState {
  verdict: FrameVerdict;
  /** True when the next frame should start a new window from scratch. */
  fresh: boolean;
  mountedAt?: number;
  windowStart: number;
  last: number;
  frames: number;
}

/**
 * Measures the real frame rate of the 3D board while it animates and reports
 * each change of verdict: step down to low quality, or give up on 3D. It draws
 * nothing. Paused stretches (hidden tab, board scrolled away, fast mode) are
 * never counted as slow frames.
 */
export function FrameWatch({
  active,
  start,
  onVerdict,
}: {
  /** False while frames are drawn on demand or the board is off screen. */
  active: boolean;
  /** What an earlier mount of the board had already concluded. */
  start: FrameVerdict;
  onVerdict: (verdict: FrameVerdict) => void;
}) {
  const watch = useRef<WatchState>({
    verdict: start,
    fresh: true,
    windowStart: 0,
    last: 0,
    frames: 0,
  });
  useEffect(() => {
    watch.current.fresh = true;
  }, [active]);
  useEffect(() => {
    const restart = () => {
      watch.current.fresh = true;
    };
    document.addEventListener("visibilitychange", restart);
    return () => document.removeEventListener("visibilitychange", restart);
  }, []);
  useFrame(() => {
    const state = watch.current;
    const now = performance.now();
    state.mountedAt ??= now;
    const paused = now - state.last > PAUSE_GAP_MS;
    if (!active || state.fresh || paused || now - state.mountedAt < GRACE_MS) {
      state.fresh = false;
      state.windowStart = now;
      state.last = now;
      state.frames = 0;
      return;
    }
    state.last = now;
    state.frames += 1;
    const elapsed = now - state.windowStart;
    if (elapsed < WINDOW_MS) return;
    const next = judgeWindow(state.verdict, windowFps(state.frames, elapsed));
    state.windowStart = now;
    state.frames = 0;
    if (next === state.verdict) return;
    state.verdict = next;
    onVerdict(next);
  });
  return null;
}
