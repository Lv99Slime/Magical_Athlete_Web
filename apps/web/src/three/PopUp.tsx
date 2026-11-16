import { createContext, useContext, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { popUpAmount } from "./stageMotion";

/**
 * Shared clock for the book-opening sequence. `opening` is undefined when the
 * book should simply be open; `start` is filled in on the first frame after an
 * opening is asked for.
 */
export interface IntroClock {
  opening?: number;
  start?: number;
}

export interface IntroHandle {
  current: IntroClock;
}

const ALWAYS_OPEN: IntroHandle = { current: {} };
const FLAT = 0.02;

export const IntroContext = createContext<IntroHandle>(ALWAYS_OPEN);

/** Milliseconds since the book started opening, or undefined when no opening plays. */
export function introElapsed(
  intro: IntroHandle,
  nowMs: number,
): number | undefined {
  const { opening, start } = intro.current;
  if (opening === undefined) return undefined;
  return start === undefined ? 0 : nowMs - start;
}

/**
 * A layer that lies flat in the closed book and springs up `delay` ms into the
 * opening. Its children must stand on the page (y = 0) for the fold to read.
 */
export function PopUp({
  delay,
  children,
}: {
  delay: number;
  children?: ReactNode;
}) {
  const intro = useContext(IntroContext);
  const layer = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!layer.current) return;
    const elapsed = introElapsed(intro, performance.now());
    layer.current.scale.y =
      elapsed === undefined ? 1 : Math.max(FLAT, popUpAmount(elapsed, delay));
  });
  return <group ref={layer}>{children}</group>;
}
