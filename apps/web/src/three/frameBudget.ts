/**
 * Decides how the 3D board should react to a slow device. Pure logic: the
 * board feeds it one frames-per-second reading per measuring window.
 */
export type Quality = "high" | "low";

export interface FrameVerdict {
  quality: Quality;
  /** Slow windows in a row while already on low quality. */
  slowWindows: number;
  /** The device cannot keep up even on low quality; show the 2D board. */
  tooSlow: boolean;
}

export const START_VERDICT: FrameVerdict = {
  quality: "high",
  slowWindows: 0,
  tooSlow: false,
};

/** Length of one measuring window. */
export const WINDOW_MS = 2000;
/** Loading textures and the book opening are not measured. */
export const GRACE_MS = 3500;
/**
 * A gap this long between frames means the page was paused, not slow. It is
 * longer than a window so that a device crawling along still counts as slow.
 */
export const PAUSE_GAP_MS = 3000;
export const DROP_QUALITY_BELOW = 26;
export const GIVE_UP_BELOW = 12;
export const GIVE_UP_AFTER = 3;

export function windowFps(frames: number, elapsedMs: number): number {
  return elapsedMs > 0 ? (frames * 1000) / elapsedMs : 0;
}

/**
 * Takes one window's frame rate into account. Quality only ever steps down,
 * so the picture never flickers between settings, and giving up needs several
 * slow windows in a row on low quality.
 */
export function judgeWindow(verdict: FrameVerdict, fps: number): FrameVerdict {
  if (verdict.tooSlow) return verdict;
  if (verdict.quality === "high")
    return fps < DROP_QUALITY_BELOW
      ? { quality: "low", slowWindows: 0, tooSlow: false }
      : verdict;
  if (fps >= GIVE_UP_BELOW)
    return verdict.slowWindows === 0 ? verdict : { ...verdict, slowWindows: 0 };
  const slowWindows = verdict.slowWindows + 1;
  return {
    quality: "low",
    slowWindows,
    tooSlow: slowWindows >= GIVE_UP_AFTER,
  };
}
