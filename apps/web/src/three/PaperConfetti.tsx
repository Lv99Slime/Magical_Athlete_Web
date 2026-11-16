import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PAPER } from "./paperTheme";
import {
  CONFETTI_COLOURS,
  CONFETTI_MS,
  confettiPiece,
  confettiPose,
} from "./pawnMotion";
import { TILE_HEIGHT } from "./trackLayout3d";

const PIECES = 40;
const BURST_SCALE = 1.5;
const COLOURS = [
  PAPER.pink,
  PAPER.blue,
  PAPER.yellow,
  PAPER.green,
  PAPER.white,
].slice(0, CONFETTI_COLOURS);

/**
 * One burst of paper scraps over a spot on the page. Mount it with a new key
 * for each burst; it plays once and then hides itself.
 */
export function PaperConfetti({
  x,
  z,
  seed,
}: {
  x: number;
  z: number;
  seed: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const started = useRef<number | undefined>(undefined);
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => confettiPiece(index, seed)),
    [seed],
  );
  const scrap = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const colour = new THREE.Color();
    pieces.forEach((piece, index) =>
      instances.setColorAt(index, colour.set(COLOURS[piece.colour])),
    );
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
  }, [pieces]);
  useFrame(() => {
    const instances = mesh.current;
    if (!instances || !instances.visible) return;
    const now = performance.now();
    started.current ??= now;
    const elapsed = now - started.current;
    if (elapsed >= CONFETTI_MS) {
      instances.visible = false;
      return;
    }
    pieces.forEach((piece, index) => {
      const pose = confettiPose(piece, elapsed);
      scrap.position.set(pose.x, pose.y, pose.z);
      scrap.rotation.set(pose.rotationX, 0, pose.rotationZ);
      scrap.scale.setScalar(piece.size * pose.scale);
      scrap.updateMatrix();
      instances.setMatrixAt(index, scrap.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[x, TILE_HEIGHT, z]} scale={BURST_SCALE}>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, PIECES]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
