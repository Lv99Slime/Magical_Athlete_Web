import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Cutout } from "./PaperScenery";
import { PAPER } from "./paperTheme";
import { spotlightPose } from "./stageMotion";
import { TILE_HEIGHT } from "./trackLayout3d";

const POINTS = 12;
const OUTER_RADIUS = 1.0;
const INNER_RADIUS = 0.62;
const ABOVE_TILE = 0.004;
const HIDDEN_SCALE = 0.001;

function burstShape(): THREE.Shape {
  const shape = new THREE.Shape();
  for (let corner = 0; corner < POINTS * 2; corner++) {
    const radius = corner % 2 === 0 ? OUTER_RADIUS : INNER_RADIUS;
    const angle = (corner / (POINTS * 2)) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (corner === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/**
 * A paper starburst that pops out of the page under a pawn whose power goes
 * off. Mount it with a new key for each power; it plays once and hides itself.
 */
export function PaperSpotlight({ x, z }: { x: number; z: number }) {
  const burst = useRef<THREE.Group>(null);
  const started = useRef<number | undefined>(undefined);
  const shape = useMemo(burstShape, []);
  useFrame(() => {
    const group = burst.current;
    if (!group || !group.visible) return;
    const now = performance.now();
    started.current ??= now;
    const pose = spotlightPose(now - started.current);
    if (pose.done) {
      group.visible = false;
      return;
    }
    group.scale.setScalar(Math.max(HIDDEN_SCALE, pose.scale));
    group.rotation.y = pose.turn;
  });
  return (
    <group ref={burst} position={[x, TILE_HEIGHT + ABOVE_TILE, z]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Cutout shape={shape} colour={PAPER.yellow} position={[0, 0, 0]} />
      </group>
    </group>
  );
}
