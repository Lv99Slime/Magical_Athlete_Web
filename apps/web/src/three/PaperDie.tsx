import { useMemo } from "react";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { PAPER } from "./paperTheme";

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

export function PaperDie({
  value,
  position,
  spin = 0,
}: {
  value: number;
  position: [number, number, number];
  spin?: number;
}) {
  const pips = useMemo(
    () =>
      FACES.flatMap((face) => {
        const facing = new THREE.Quaternion().setFromUnitVectors(
          FORWARD,
          face.normal,
        );
        return PIPS[face.value].map(([column, row]) => ({
          key: `${face.value}-${column}-${row}`,
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
  const rotation = useMemo(() => dieRotationFor(value, spin), [value, spin]);
  return (
    <group position={position} quaternion={rotation}>
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
