import { useEffect, useMemo, useRef } from "react";
import { Outlines, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PAPER } from "./paperTheme";
import { settlePose, tumblePose } from "./stageMotion";

const SIZE = 0.62;
const PIP_RADIUS = 0.055;
const PIP_SPREAD = 0.165;

/** Pip grid coordinates (-1, 0, 1) for each face value. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, 1],
    [1, -1],
  ],
  3: [
    [-1, 1],
    [0, 0],
    [1, -1],
  ],
  4: [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ],
  5: [
    [-1, 1],
    [1, 1],
    [0, 0],
    [-1, -1],
    [1, -1],
  ],
  6: [
    [-1, 1],
    [1, 1],
    [-1, 0],
    [1, 0],
    [-1, -1],
    [1, -1],
  ],
};

interface DieFace {
  value: number;
  normal: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

/** Opposite faces add up to seven, as on a real die. */
const FACES: DieFace[] = [
  { value: 1, normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  { value: 6, normal: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
  { value: 2, normal: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  { value: 5, normal: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  { value: 3, normal: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  { value: 4, normal: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1] },
].map((face) => ({
  value: face.value,
  normal: new THREE.Vector3(...(face.normal as [number, number, number])),
  right: new THREE.Vector3(...(face.right as [number, number, number])),
  up: new THREE.Vector3(...(face.up as [number, number, number])),
}));

const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** Rotation that turns the face showing `value` towards the sky. */
export function dieRotationFor(value: number, spin = 0): THREE.Quaternion {
  const face = FACES.find((candidate) => candidate.value === value) ?? FACES[0];
  const toTop = new THREE.Quaternion().setFromUnitVectors(face.normal, UP);
  const twist = new THREE.Quaternion().setFromAxisAngle(UP, spin);
  return twist.multiply(toTop);
}

export interface PaperDieProps {
  /** The face the engine rolled; not known while the die is still in the air. */
  value?: number;
  /** Where the die comes to rest. */
  position: [number, number, number];
  spin?: number;
  /** True while the roll is being played back, before the result is shown. */
  rolling?: boolean;
  /** Changes with every roll; it seeds the throw so replays look the same. */
  rollId?: number;
  /** Reduced-motion and fast modes: the die just shows the result. */
  still?: boolean;
}

/** Animation bookkeeping kept between frames; never read while rendering. */
interface DieState {
  mode: "rest" | "tumble" | "settle";
  rollId?: number;
  start: number;
}

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

/**
 * The paper die. It tumbles while a roll is played back and then settles with
 * the engine's result on top; it never picks a face itself.
 */
export function PaperDie({
  value,
  position,
  spin = 0,
  rolling = false,
  rollId = 0,
  still = false,
}: PaperDieProps) {
  const pips = useMemo(
    () =>
      FACES.flatMap((face) => {
        const facing = new THREE.Quaternion().setFromUnitVectors(
          FORWARD,
          face.normal,
        );
        return PIPS[face.value].map(([column, row]) => ({
          key: [face.value, column, row].join("-"),
          quaternion: facing,
          position: face.normal
            .clone()
            .multiplyScalar(SIZE / 2 + 0.002)
            .addScaledVector(face.right, column * PIP_SPREAD)
            .addScaledVector(face.up, row * PIP_SPREAD),
        }));
      }),
    [],
  );
  const rest = useMemo(() => dieRotationFor(value ?? 1, spin), [value, spin]);
  const die = useRef<THREE.Group>(null);
  const motion = useRef<DieState>({ mode: "rest", start: 0 });
  const thrown = useMemo(
    () => ({
      quaternion: new THREE.Quaternion(),
      position: new THREE.Vector3(),
    }),
    [],
  );
  const invalidate = useThree((state) => state.invalidate);
  // Ask for a frame when the die changes; needed when frames are drawn on demand.
  useEffect(() => {
    invalidate();
  }, [value, spin, rolling, still, invalidate]);
  const [restX, restY, restZ] = position;
  useFrame(() => {
    const group = die.current;
    if (!group) return;
    const now = performance.now();
    const state = motion.current;
    if (still) {
      state.mode = "rest";
    } else if (rolling) {
      if (state.mode !== "tumble" || state.rollId !== rollId) {
        state.mode = "tumble";
        state.rollId = rollId;
        state.start = now;
      }
    } else if (state.mode === "tumble") {
      // The result is in: start from wherever the tumble left the die.
      state.mode = "settle";
      state.start = now;
      thrown.quaternion.copy(group.quaternion);
      thrown.position.copy(group.position);
    }
    if (state.mode === "tumble") {
      const pose = tumblePose(now - state.start, rollId);
      group.position.set(restX + pose.x, restY + pose.y, restZ + pose.z);
      group.rotation.set(pose.rotationX, pose.rotationY, pose.rotationZ);
      return;
    }
    if (state.mode === "settle") {
      const pose = settlePose(now - state.start);
      group.position.set(
        mix(thrown.position.x, restX, pose.blend),
        mix(thrown.position.y, restY, pose.blend) + pose.hop,
        mix(thrown.position.z, restZ, pose.blend),
      );
      group.quaternion.slerpQuaternions(thrown.quaternion, rest, pose.blend);
      if (pose.done) state.mode = "rest";
      return;
    }
    group.position.set(restX, restY, restZ);
    group.quaternion.copy(rest);
  });
  return (
    <group ref={die}>
      <RoundedBox
        args={[SIZE, SIZE, SIZE]}
        radius={0.085}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial color={PAPER.white} roughness={1} />
        <Outlines screenspace thickness={0.024} color={PAPER.ink} />
      </RoundedBox>
      {pips.map((pip) => (
        <mesh key={pip.key} position={pip.position} quaternion={pip.quaternion}>
          <circleGeometry args={[PIP_RADIUS, 20]} />
          <meshBasicMaterial color={PAPER.ink} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
