import { useContext, useEffect, useMemo, useRef } from "react";
import { Outlines, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PAPER, paperGrain } from "./paperTheme";
import { IntroContext, introElapsed } from "./PopUp";
import { bookOpenAmount } from "./stageMotion";

export interface BookSize {
  width: number;
  /** Z of the fold between the flat page and the standing page. */
  backZ: number;
  /** Z of the front edge of the flat page. */
  frontZ: number;
  /** Height of the standing page. */
  backHeight: number;
}

const PAGE_THICKNESS = 0.12;
const COVER_THICKNESS = 0.14;
const COVER_MARGIN = 0.32;
const BACK_LEAN = 0.16;
/** How far the standing page is folded over the board before the book opens. */
const SHUT_ANGLE = 1.25;
const ILLUSTRATION_ASPECT = 1536 / 1024;

/** The open book: a flat page for the board and a standing page as backdrop. */
export function PaperBook({ size }: { size: BookSize }) {
  const depth = size.frontZ - size.backZ;
  const centreZ = (size.frontZ + size.backZ) / 2;
  const grain = useMemo(() => {
    const texture = paperGrain().clone();
    texture.repeat.set(size.width / 3, depth / 3);
    texture.needsUpdate = true;
    return texture;
  }, [size.width, depth]);
  const world = useTexture(`${import.meta.env.BASE_URL}art/race-world.webp`);
  const artWidth = size.width - 0.9;
  const artHeight = size.backHeight - 0.8;
  const backdrop = useMemo(() => {
    const texture = world.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    // Keep a wide band around the horizon: sky, castle and grandstand.
    const band = Math.min(1, ILLUSTRATION_ASPECT / (artWidth / artHeight));
    texture.repeat.set(1, band);
    texture.offset.set(0, Math.min(1 - band, 0.46));
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [world, artWidth, artHeight]);
  useEffect(
    () => () => {
      grain.dispose();
      backdrop.dispose();
    },
    [grain, backdrop],
  );
  const intro = useContext(IntroContext);
  const standing = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!standing.current) return;
    const elapsed = introElapsed(intro, performance.now());
    const open = elapsed === undefined ? 1 : bookOpenAmount(elapsed);
    standing.current.rotation.x = -BACK_LEAN + (1 - open) * SHUT_ANGLE;
  });
  return (
    <group>
      {/* Flat page and cover */}
      <mesh
        position={[0, -PAGE_THICKNESS - COVER_THICKNESS / 2, centreZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            size.width + COVER_MARGIN * 2,
            COVER_THICKNESS,
            depth + COVER_MARGIN * 2,
          ]}
        />
        <meshStandardMaterial color={PAPER.plum} roughness={1} />
        <Outlines screenspace thickness={0.045} color={PAPER.ink} />
      </mesh>
      <mesh position={[0, -PAGE_THICKNESS / 2, centreZ]} receiveShadow>
        <boxGeometry args={[size.width, PAGE_THICKNESS, depth]} />
        <meshStandardMaterial
          color={PAPER.page}
          roughness={1}
          bumpMap={grain}
          bumpScale={0.6}
        />
      </mesh>

      {/* Standing page, hinged on the fold and leaning back slightly */}
      <group ref={standing} position={[0, 0, size.backZ]}>
        <mesh position={[0, size.backHeight / 2, -0.14]} castShadow>
          <boxGeometry
            args={[
              size.width + COVER_MARGIN * 2,
              size.backHeight + COVER_MARGIN,
              COVER_THICKNESS,
            ]}
          />
          <meshStandardMaterial color={PAPER.plum} roughness={1} />
          <Outlines screenspace thickness={0.045} color={PAPER.ink} />
        </mesh>
        <mesh position={[0, size.backHeight / 2, -0.03]} receiveShadow>
          <boxGeometry args={[size.width, size.backHeight, 0.06]} />
          <meshStandardMaterial color={PAPER.page} roughness={1} />
        </mesh>
        <mesh position={[0, size.backHeight / 2 + 0.1, 0.004]} receiveShadow>
          <planeGeometry args={[artWidth, artHeight]} />
          <meshStandardMaterial map={backdrop} roughness={1} />
        </mesh>
      </group>

      {/* Printed crease along the fold */}
      <mesh
        position={[0, 0.003, size.backZ + 0.06]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size.width, 0.07]} />
        <meshBasicMaterial color={PAPER.paperEdge} toneMapped={false} />
      </mesh>
    </group>
  );
}
