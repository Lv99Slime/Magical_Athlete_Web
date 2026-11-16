import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import {
  LABEL_FONT,
  PAPER,
  roundedRectPath,
  useCanvasTexture,
} from "./paperTheme";
import { PopUp } from "./PopUp";

const PAPER_THICKNESS = 0.04;
const INK_WIDTH = 0.06;
/** When each layer springs up as the book opens, in ms; back layers go first. */
const POP_DELAYS = {
  farHills: 350,
  sky: 470,
  trees: 560,
  nearHills: 650,
  infield: 800,
};

/**
 * Flat ink line around a shape: one quad per edge plus a small disc at every
 * corner. It sits just behind the front of the card, so only the outer half
 * shows. (An inverted-hull outline bulges through many-sided cutouts.)
 */
function inkEdgeGeometry(
  shape: THREE.Shape,
  width: number,
): THREE.BufferGeometry {
  const half = width / 2;
  const raw = shape.getPoints(20);
  const points = raw.filter(
    (point, index) =>
      point.distanceTo(raw[(index + raw.length - 1) % raw.length]) > 1e-5,
  );
  const positions: number[] = [];
  const joinSides = 8;
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    const along = end.clone().sub(start);
    if (along.lengthSq() < 1e-10) return;
    along.normalize();
    const across = new THREE.Vector2(-along.y, along.x).multiplyScalar(half);
    const corners = [
      start.clone().add(across),
      start.clone().sub(across),
      end.clone().sub(across),
      end.clone().add(across),
    ];
    for (const corner of [0, 1, 2, 0, 2, 3])
      positions.push(corners[corner].x, corners[corner].y, 0);
    for (let side = 0; side < joinSides; side++) {
      const from = (side / joinSides) * Math.PI * 2;
      const to = ((side + 1) / joinSides) * Math.PI * 2;
      positions.push(
        start.x,
        start.y,
        0,
        start.x + Math.cos(from) * half,
        start.y + Math.sin(from) * half,
        0,
        start.x + Math.cos(to) * half,
        start.y + Math.sin(to) * half,
        0,
      );
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

/** One flat piece of card cut to `shape`, standing on its bottom edge. */
export function Cutout({
  shape,
  colour,
  position,
  lean = 0,
  children,
}: {
  shape: THREE.Shape;
  colour: string;
  position: [number, number, number];
  lean?: number;
  children?: ReactNode;
}) {
  const settings = useMemo(
    () => ({ depth: PAPER_THICKNESS, bevelEnabled: false, curveSegments: 20 }),
    [],
  );
  const ink = useMemo(() => inkEdgeGeometry(shape, INK_WIDTH), [shape]);
  useEffect(() => () => ink.dispose(), [ink]);
  return (
    <group position={position} rotation={[-lean, 0, 0]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, settings]} />
        {/* Only the far side is drawn into the shadow map, so the lit face never shadows itself. */}
        <meshStandardMaterial
          color={colour}
          roughness={1}
          shadowSide={THREE.BackSide}
        />
      </mesh>
      <mesh geometry={ink} position={[0, 0, PAPER_THICKNESS - 0.006]}>
        <meshBasicMaterial
          color={PAPER.ink}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {children}
    </group>
  );
}

/** Rolling silhouette built from a few overlapping sine waves. */
function hillShape(
  width: number,
  height: number,
  waves: readonly [number, number, number][],
): THREE.Shape {
  const shape = new THREE.Shape();
  const samples = 72;
  shape.moveTo(-width / 2, 0);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const wave = waves.reduce(
      (sum, [frequency, phase, amount]) =>
        sum + Math.sin(t * Math.PI * frequency + phase) * amount,
      0,
    );
    shape.lineTo(
      -width / 2 + t * width,
      Math.max(0.25, height * (0.62 + wave)),
    );
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

function battlementShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  const tooth = 0.16;
  const teeth = Math.max(3, Math.round(width / (tooth * 2)));
  const step = width / (teeth * 2 - 1);
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height);
  for (let i = 0; i < teeth * 2 - 1; i++) {
    const x = -width / 2 + i * step;
    const y = i % 2 === 0 ? height : height - tooth * 0.8;
    shape.lineTo(x, y);
    shape.lineTo(x + step, y);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

function roofShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, height);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

function archShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height - width / 2);
  shape.absarc(0, height - width / 2, width / 2, Math.PI, 0, true);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

function capShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.absellipse(0, 0, radius, radius * 0.72, Math.PI, 0, true, 0);
  shape.closePath();
  return shape;
}

function stemShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.62, 0);
  shape.quadraticCurveTo(-width * 0.3, height * 0.5, -width / 2, height);
  shape.lineTo(width / 2, height);
  shape.quadraticCurveTo(width * 0.3, height * 0.5, width * 0.62, 0);
  shape.closePath();
  return shape;
}

function cloudShape(scale: number): THREE.Shape {
  const shape = new THREE.Shape();
  const s = scale;
  shape.moveTo(-1.0 * s, 0);
  shape.absarc(
    -0.58 * s,
    0.2 * s,
    0.4 * s,
    Math.PI * 1.12,
    Math.PI * 0.38,
    true,
  );
  shape.absarc(
    0.02 * s,
    0.42 * s,
    0.5 * s,
    Math.PI * 0.86,
    Math.PI * 0.12,
    true,
  );
  shape.absarc(
    0.62 * s,
    0.2 * s,
    0.38 * s,
    Math.PI * 0.62,
    -Math.PI * 0.12,
    true,
  );
  shape.lineTo(1.0 * s, 0);
  shape.closePath();
  return shape;
}

function treeShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  const tiers = 3;
  shape.moveTo(-width / 2, 0);
  for (let tier = 0; tier < tiers; tier++) {
    const y = (height * (tier + 1)) / tiers;
    const inset = (width / 2) * ((tier + 1) / tiers) * 0.72;
    shape.lineTo(-inset * (tier === tiers - 1 ? 0 : 1), y);
    if (tier < tiers - 1) shape.lineTo(-width / 2 + inset * 0.75, y - 0.02);
  }
  for (let tier = tiers - 2; tier >= 0; tier--) {
    const y = (height * (tier + 1)) / tiers;
    const inset = (width / 2) * ((tier + 1) / tiers) * 0.72;
    shape.lineTo(width / 2 - inset * 0.75, y - 0.02);
    shape.lineTo(inset, y);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

function Mushroom({
  position,
  scale = 1,
  colour = PAPER.pink,
  lean = 0.1,
}: {
  position: [number, number, number];
  scale?: number;
  colour?: string;
  lean?: number;
}) {
  const stem = useMemo(() => stemShape(0.34 * scale, 0.7 * scale), [scale]);
  const cap = useMemo(() => capShape(0.62 * scale), [scale]);
  const dots: [number, number, number][] = [
    [-0.28, 0.2, 0.09],
    [0.08, 0.3, 0.11],
    [0.34, 0.14, 0.07],
  ];
  return (
    <group position={position} rotation={[-lean, 0, 0]}>
      <Cutout shape={stem} colour={PAPER.paperLight} position={[0, 0, 0]} />
      <Cutout shape={cap} colour={colour} position={[0, 0.66 * scale, 0.05]}>
        {dots.map(([x, y, radius]) => (
          <mesh
            key={`${x}-${y}`}
            position={[x * scale, y * scale, PAPER_THICKNESS + 0.004]}
          >
            <circleGeometry args={[radius * scale, 20]} />
            <meshStandardMaterial color={PAPER.white} roughness={1} />
          </mesh>
        ))}
      </Cutout>
    </group>
  );
}

function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const crown = useMemo(() => treeShape(0.9 * scale, 1.5 * scale), [scale]);
  return (
    <group position={position} rotation={[-0.1, 0, 0]}>
      <mesh position={[0, 0.16 * scale, 0]} castShadow>
        <boxGeometry args={[0.14 * scale, 0.32 * scale, 0.03]} />
        <meshStandardMaterial color={PAPER.inkSoft} roughness={1} />
      </mesh>
      <Cutout
        shape={crown}
        colour={PAPER.greenDeep}
        position={[0, 0.28 * scale, 0.02]}
      />
    </group>
  );
}

function Cloud({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const shape = useMemo(() => cloudShape(scale), [scale]);
  const stalk = position[1];
  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Thin card strut that holds the cloud above the page. */}
      <mesh position={[0, stalk / 2, -0.03]}>
        <boxGeometry args={[0.05, stalk, 0.012]} />
        <meshStandardMaterial color={PAPER.paperEdge} roughness={1} />
      </mesh>
      <Cutout shape={shape} colour={PAPER.white} position={[0, stalk, 0]} />
    </group>
  );
}

function Castle({ position }: { position: [number, number, number] }) {
  const wall = useMemo(() => battlementShape(3.4, 1.15), []);
  const sideTower = useMemo(() => battlementShape(0.72, 1.85), []);
  const keep = useMemo(() => battlementShape(1.0, 2.2), []);
  const smallRoof = useMemo(() => roofShape(0.92, 0.85), []);
  const bigRoof = useMemo(() => roofShape(1.24, 1.05), []);
  const door = useMemo(() => archShape(0.5, 0.72), []);
  const flag = useMemo(() => roofShape(0.34, 0.3), []);
  const towers: [number, THREE.Shape, THREE.Shape, number][] = [
    [-1.55, sideTower, smallRoof, 1.85],
    [0, keep, bigRoof, 2.2],
    [1.55, sideTower, smallRoof, 1.85],
  ];
  return (
    <group position={position} rotation={[-0.08, 0, 0]}>
      <Cutout shape={wall} colour={PAPER.pink} position={[0, 0, 0]} />
      {towers.map(([x, body, roof, height]) => (
        <group key={x} position={[x, 0, 0.06]}>
          <Cutout shape={body} colour={PAPER.paper} position={[0, 0, 0]} />
          <Cutout
            shape={roof}
            colour={PAPER.plum}
            position={[0, height - 0.06, 0.05]}
          />
          <mesh position={[0, height + (x === 0 ? 1.2 : 1.0), 0.07]}>
            <boxGeometry args={[0.03, 0.5, 0.02]} />
            <meshStandardMaterial color={PAPER.ink} roughness={1} />
          </mesh>
          <group
            position={[0.17, height + (x === 0 ? 1.28 : 1.08), 0.07]}
            rotation={[0, 0, -Math.PI / 2]}
          >
            <Cutout shape={flag} colour={PAPER.yellow} position={[0, 0, 0]} />
          </group>
        </group>
      ))}
      <Cutout shape={door} colour={PAPER.plum} position={[0, 0, 0.13]} />
    </group>
  );
}

/** Paper banner on two struts, naming the track from inside the U. */
function TitleBanner({
  title,
  position,
}: {
  title: string;
  position: [number, number, number];
}) {
  const width = 4.6;
  const height = 0.78;
  const face = useCanvasTexture(
    (context, w, h) => {
      context.fillStyle = PAPER.ink;
      roundedRectPath(context, 0, 0, w, h, 20);
      context.fill();
      context.fillStyle = PAPER.paperLight;
      roundedRectPath(context, 9, 9, w - 18, h - 18, 13);
      context.fill();
      context.fillStyle = PAPER.ink;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `italic bold ${Math.round(h * 0.5)}px Georgia, ${LABEL_FONT}`;
      context.fillText(title, w / 2, h / 2 + 4);
    },
    width * 200,
    height * 200,
    [title],
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
  return (
    <group position={position} rotation={[-0.42, 0, -0.02]}>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} position={[x, 0.14, -0.03]}>
          <boxGeometry args={[0.1, 0.32, 0.02]} />
          <meshStandardMaterial color={PAPER.paperEdge} roughness={1} />
        </mesh>
      ))}
      <mesh
        position={[0, 0.3 + height / 2, 0]}
        material={materials.list}
        castShadow
      >
        <boxGeometry args={[width, height, 0.035]} />
      </mesh>
    </group>
  );
}

/**
 * Tall layers stand behind the upper straight; the infield only gets low pieces
 * so nothing hides a pawn from the default camera.
 */
export function PaperScenery({
  title,
  backZ,
  width,
}: {
  title: string;
  /** Z of the page fold; layers step forward from here. */
  backZ: number;
  width: number;
}) {
  const farHills = useMemo(
    () =>
      hillShape(width - 0.6, 2.3, [
        [3.1, 0.4, 0.2],
        [7.3, 1.3, 0.07],
      ]),
    [width],
  );
  const nearHills = useMemo(
    () =>
      hillShape(width - 0.2, 1.25, [
        [4.2, 2.2, 0.22],
        [9.1, 0.3, 0.08],
      ]),
    [width],
  );
  const bush = useMemo(
    () =>
      hillShape(1.5, 0.5, [
        [2.2, 0.2, 0.25],
        [6.0, 1.0, 0.08],
      ]),
    [],
  );
  return (
    <group>
      <PopUp delay={POP_DELAYS.farHills}>
        <Cutout
          shape={farHills}
          colour={PAPER.teal}
          position={[0, 0, backZ + 0.35]}
          lean={0.06}
        />
      </PopUp>
      <PopUp delay={POP_DELAYS.sky}>
        <Cloud position={[-6.4, 3.1, backZ + 0.6]} scale={0.95} />
        <Cloud position={[-1.7, 3.5, backZ + 0.55]} scale={0.7} />
        <Cloud position={[5.9, 3.2, backZ + 0.6]} scale={1.05} />
        <Castle position={[2.4, 0, backZ + 0.85]} />
      </PopUp>
      <PopUp delay={POP_DELAYS.trees}>
        <Tree position={[-7.6, 0, backZ + 1.0]} scale={1.25} />
        <Tree position={[-6.6, 0, backZ + 1.15]} scale={0.95} />
        <Tree position={[-3.2, 0, backZ + 1.0]} scale={1.1} />
        <Tree position={[6.3, 0, backZ + 1.05]} scale={1.15} />
      </PopUp>
      <PopUp delay={POP_DELAYS.nearHills}>
        <Cutout
          shape={nearHills}
          colour={PAPER.green}
          position={[0, 0, backZ + 1.4]}
          lean={0.1}
        />
        <Mushroom position={[-8.4, 0, backZ + 1.75]} scale={1.5} />
        <Mushroom
          position={[-4.9, 0, backZ + 1.8]}
          scale={0.95}
          colour={PAPER.yellow}
        />
        <Mushroom position={[8.3, 0, backZ + 1.75]} scale={1.35} />
        <Mushroom
          position={[4.6, 0, backZ + 1.85]}
          scale={0.8}
          colour={PAPER.blue}
        />
      </PopUp>
      <PopUp delay={POP_DELAYS.infield}>
        <TitleBanner title={title} position={[-0.6, 0, 0.35]} />
        <Mushroom position={[-5.4, 0, -0.1]} scale={0.6} lean={0.25} />
        <Mushroom
          position={[-4.7, 0, 0.3]}
          scale={0.42}
          colour={PAPER.yellow}
          lean={0.25}
        />
        <Cutout
          shape={bush}
          colour={PAPER.green}
          position={[3.3, 0, -0.2]}
          lean={0.3}
        />
        <Cutout
          shape={bush}
          colour={PAPER.greenDeep}
          position={[-3.1, 0, 0.9]}
          lean={0.3}
        />
      </PopUp>
    </group>
  );
}
