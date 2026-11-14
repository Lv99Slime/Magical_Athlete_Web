import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useI18n } from "../i18n";
import { PaperBook, type BookSize } from "./PaperBook";
import { PaperScenery } from "./PaperScenery";
import { PaperTrack, type TrackSpace } from "./PaperTrack";
import { PAPER } from "./paperTheme";
import { trackBounds } from "./trackLayout3d";

export const FIELD_OF_VIEW = 32;
const CAMERA_ELEVATION = (50 * Math.PI) / 180;
const SIDE_MARGIN = 1.1;
const BACK_MARGIN = 2.5;
const FRONT_MARGIN = 0.75;
const NARROW_ASPECT = 1.15;
const FOLLOW_LIMIT_X = 6.6;
const FOLLOW_LIMIT_Z = 1.8;
/** Wide views only lean towards the action, so the whole book stays in sight. */
const WIDE_FOLLOW_SHARE = 0.12;

export interface StageTrack {
  id: string;
  name: string;
  secondCornerPosition: number;
  specialSpaces: readonly TrackSpace[];
}

export function bookSize(): BookSize {
  const bounds = trackBounds();
  return {
    width: bounds.maxX - bounds.minX + SIDE_MARGIN * 2,
    backZ: bounds.minZ - BACK_MARGIN,
    frontZ: bounds.maxZ + FRONT_MARGIN,
    backHeight: 5.0,
  };
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}

interface OrbitHandle {
  target: THREE.Vector3;
  update: () => void;
}

const clamp = (value: number, limit: number) =>
  Math.min(limit, Math.max(-limit, value));

/**
 * Wide views frame the whole book and, while `tracking` a playback, lean a
 * little towards `focus`. Narrow views cannot fit the book, so they stay close
 * and glide to `focus` (the pawn that is moving, or the racer whose turn it
 * is); without a focus they open on the first corner and can be dragged around.
 */
export function CameraRig({
  size,
  focus,
  tracking = false,
  still = false,
}: {
  size: BookSize;
  focus?: { x: number; z: number };
  /** True while moves are being played back. */
  tracking?: boolean;
  still?: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree(
    (state) => state.controls,
  ) as unknown as OrbitHandle | null;
  const invalidate = useThree((state) => state.invalidate);
  const aspect = useThree((state) => state.size.width / state.size.height);
  const narrow = aspect < NARROW_ASPECT;
  const follow = narrow && focus !== undefined;
  const home = useMemo<[number, number, number]>(
    () => (narrow ? [5.4, 0.6, -0.5] : [0, 0.9, -1.9]),
    [narrow],
  );
  const lean = !narrow && tracking && focus !== undefined;
  const goalX = follow
    ? clamp(focus.x, FOLLOW_LIMIT_X)
    : home[0] + (lean ? focus.x * WIDE_FOLLOW_SHARE : 0);
  const goalZ = follow
    ? clamp(focus.z, FOLLOW_LIMIT_Z) - 0.3
    : home[2] + (lean ? focus.z * WIDE_FOLLOW_SHARE : 0);
  const goal = useRef(new THREE.Vector3(goalX, home[1], goalZ));
  const step = useRef(new THREE.Vector3());
  // Only pull the view while it is on its way to a new goal, so a view the
  // player has dragged elsewhere is left alone until the goal next changes.
  const arrived = useRef(false);
  useEffect(() => {
    goal.current.set(goalX, home[1], goalZ);
    arrived.current = false;
    invalidate();
  }, [goalX, goalZ, home, invalidate]);
  useEffect(() => {
    const halfFov = (FIELD_OF_VIEW * Math.PI) / 360;
    // The near edge of the book is closer than the target, so pad the distance.
    const visibleWidth = narrow ? 8.2 : size.width + 1.2;
    const forWidth = visibleWidth / (2 * Math.tan(halfFov) * aspect) + 3.6;
    const forHeight = (narrow ? 9 : 12.2) / (2 * Math.tan(halfFov)) + 2;
    const distance = Math.max(forWidth, forHeight);
    const target = goal.current;
    camera.position.set(
      target.x,
      target.y + Math.sin(CAMERA_ELEVATION) * distance,
      target.z + Math.cos(CAMERA_ELEVATION) * distance,
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    invalidate();
  }, [camera, controls, aspect, narrow, size.width, invalidate]);
  useFrame((_, delta) => {
    if (!controls || arrived.current) return;
    step.current.copy(goal.current).sub(controls.target);
    if (step.current.lengthSq() < 1e-6) {
      arrived.current = true;
      return;
    }
    // Move the camera with its target so the player's chosen angle is kept.
    step.current.multiplyScalar(
      still ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 4),
    );
    controls.target.add(step.current);
    camera.position.add(step.current);
    controls.update();
  });
  return (
    <OrbitControls
      makeDefault
      enablePan={narrow && !follow}
      minDistance={8}
      maxDistance={60}
      minPolarAngle={0.35}
      maxPolarAngle={1.3}
      minAzimuthAngle={-0.7}
      maxAzimuthAngle={0.7}
    />
  );
}

/** Lights, the open book, scenery and the track. Pawns and dice go in as children. */
export function PaperStage({
  track,
  children,
}: {
  track: StageTrack;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const size = useMemo(bookSize, []);
  const title = t(
    track.name,
    track.id === "mild_mile" ? "悠閒一哩 · Mild Mile" : "狂野荒野 · Wild Wilds",
  );
  return (
    <>
      <color attach="background" args={[PAPER.background]} />
      <hemisphereLight args={[PAPER.white, PAPER.paper, 1.6]} />
      <directionalLight
        position={[-7, 15, 10]}
        intensity={1.45}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0015}
        shadow-normalBias={0.04}
      />
      <mesh
        position={[0, -0.27, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 80]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
      <PaperBook size={size} />
      <PaperScenery title={title} backZ={size.backZ} width={size.width} />
      <PaperTrack
        spaces={track.specialSpaces}
        secondCorner={track.secondCornerPosition}
        labels={{
          start: t("START", "起點"),
          finish: t("FINISH", "終點"),
          star: t("+1 pt", "+1 分"),
          trip: t("TRIP", "絆倒"),
        }}
      />
      {children}
    </>
  );
}
