import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  LABEL_FONT,
  NUMBER_FONT,
  PAPER,
  roundedRectPath,
  useCanvasTexture,
} from "./paperTheme";
import {
  isRightColumn,
  LAST_POSITION,
  TILE_HEIGHT,
  tileRect,
} from "./trackLayout3d";

export interface TrackSpace {
  position: number;
  type: string;
  delta?: number;
}

export interface TrackLabels {
  start: string;
  finish: string;
  star: string;
  trip: string;
}

const PIXELS_PER_UNIT = 220;
const TAB_WIDTH = 0.62;
const TAB_HEIGHT = 0.52;
const TAB_LEAN = 0.22;

function tileColour(position: number, type?: string): string {
  if (position === 0 || position === LAST_POSITION) return PAPER.ink;
  if (type === "star") return PAPER.yellow;
  if (type === "trip") return PAPER.pink;
  if (type === "arrow") return PAPER.blue;
  return PAPER.paperLight;
}

function effectText(space: TrackSpace, labels: TrackLabels): string {
  if (space.type === "star") return labels.star;
  if (space.type === "trip") return labels.trip;
  const delta = space.delta ?? 0;
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
}

function PaperTile({
  position,
  space,
  corner,
  labels,
}: {
  position: number;
  space?: TrackSpace;
  corner: boolean;
  labels: TrackLabels;
}) {
  const rect = tileRect(position);
  const dark = position === 0 || position === LAST_POSITION;
  const caption =
    position === 0
      ? labels.start
      : position === LAST_POSITION
        ? labels.finish
        : String(position);
  const effect = space ? effectText(space, labels) : "";
  const top = useCanvasTexture(
    (context, width, height) => {
      const border = corner ? 12 : 9;
      context.fillStyle = corner ? PAPER.plum : PAPER.ink;
      roundedRectPath(context, 0, 0, width, height, 26);
      context.fill();
      context.fillStyle = tileColour(position, space?.type);
      roundedRectPath(
        context,
        border,
        border,
        width - border * 2,
        height - border * 2,
        18,
      );
      context.fill();
      context.fillStyle = dark ? PAPER.paper : PAPER.ink;
      context.textBaseline = "top";
      context.font = dark
        ? `bold 52px ${LABEL_FONT}`
        : `bold 66px ${NUMBER_FONT}`;
      context.fillText(caption, border + 14, border + 12);
      if (effect) {
        context.font = `bold 44px ${LABEL_FONT}`;
        context.fillText(effect, border + 14, border + 86);
      }
      if (position === LAST_POSITION) {
        const cell = 26;
        const columns = Math.floor((width - border * 2 - 28) / cell);
        for (let row = 0; row < 3; row++)
          for (let column = 0; column < columns; column++)
            if ((row + column) % 2 === 0) {
              context.fillStyle = PAPER.paper;
              context.fillRect(
                border + 14 + column * cell,
                height - border - 14 - (row + 1) * cell,
                cell,
                cell,
              );
            }
      }
    },
    rect.width * PIXELS_PER_UNIT,
    rect.depth * PIXELS_PER_UNIT,
    [position, space?.type, space?.delta, corner, caption, effect],
  );
  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({
      color: dark ? PAPER.ink : PAPER.paperEdge,
      roughness: 1,
    });
    const face = new THREE.MeshStandardMaterial({ map: top, roughness: 1 });
    // BoxGeometry face order: +x, -x, +y (top), -y, +z, -z.
    return { side, face, list: [side, side, face, side, side, side] };
  }, [top, dark]);
  useEffect(
    () => () => {
      materials.side.dispose();
      materials.face.dispose();
    },
    [materials],
  );
  return (
    <mesh
      position={[rect.x, TILE_HEIGHT / 2, rect.z]}
      material={materials.list}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[rect.width, TILE_HEIGHT, rect.depth]} />
    </mesh>
  );
}

/** A little card folded up from the page behind a special space. */
function PopUpTab({
  space,
  labels,
}: {
  space: TrackSpace;
  labels: TrackLabels;
}) {
  const rect = tileRect(space.position);
  const text = effectText(space, labels);
  const colour = tileColour(space.position, space.type);
  const face = useCanvasTexture(
    (context, width, height) => {
      context.fillStyle = PAPER.ink;
      roundedRectPath(context, 0, 0, width, height, 22);
      context.fill();
      context.fillStyle = colour;
      roundedRectPath(context, 8, 8, width - 16, height - 16, 15);
      context.fill();
      context.fillStyle = PAPER.ink;
      context.textAlign = "center";
      context.textBaseline = "middle";
      if (space.type === "star") {
        context.font = `bold 62px ${LABEL_FONT}`;
        context.fillText("★", width / 2, height * 0.36);
        context.font = `bold 34px ${LABEL_FONT}`;
        context.fillText(text, width / 2, height * 0.74);
      } else if (space.type === "trip") {
        context.font = `bold 64px ${LABEL_FONT}`;
        context.fillText("✕", width / 2, height * 0.36);
        context.font = `bold 34px ${LABEL_FONT}`;
        context.fillText(text, width / 2, height * 0.74);
      } else {
        context.font = `bold 78px ${NUMBER_FONT}`;
        context.fillText(text, width / 2, height / 2 + 4);
      }
    },
    TAB_WIDTH * 260,
    TAB_HEIGHT * 260,
    [space.position, space.type, space.delta, text, colour],
  );
  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({
      color: PAPER.paperEdge,
      roughness: 1,
    });
    const front = new THREE.MeshStandardMaterial({ map: face, roughness: 1 });
    return { side, front, list: [side, side, side, side, front, side] };
  }, [face]);
  useEffect(
    () => () => {
      materials.side.dispose();
      materials.front.dispose();
    },
    [materials],
  );
  const outside = isRightColumn(space.position);
  const x = outside ? rect.x + rect.width / 2 + TAB_WIDTH / 2 + 0.08 : rect.x;
  const z = outside ? rect.z + 0.1 : rect.z - rect.depth / 2 + 0.05;
  return (
    <group position={[x, TILE_HEIGHT, z]} rotation={[-TAB_LEAN, 0, 0]}>
      <mesh
        position={[0, TAB_HEIGHT / 2, 0]}
        material={materials.list}
        castShadow
      >
        <boxGeometry args={[TAB_WIDTH, TAB_HEIGHT, 0.03]} />
      </mesh>
    </group>
  );
}

export function PaperTrack({
  spaces,
  secondCorner,
  labels,
}: {
  spaces: readonly TrackSpace[];
  secondCorner: number;
  labels: TrackLabels;
}) {
  return (
    <group>
      {Array.from({ length: LAST_POSITION + 1 }, (_, position) => (
        <PaperTile
          key={position}
          position={position}
          space={spaces.find((space) => space.position === position)}
          corner={position === 12 || position === secondCorner}
          labels={labels}
        />
      ))}
      {spaces.map((space) => (
        <PopUpTab key={space.position} space={space} labels={labels} />
      ))}
    </group>
  );
}
