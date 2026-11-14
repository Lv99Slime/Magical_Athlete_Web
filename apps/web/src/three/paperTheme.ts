import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Flat print colours shared with the 2D paper edition. */
export const PAPER = {
  ink: "#25241f",
  inkSoft: "#595649",
  page: "#f2e9d2",
  paper: "#ede4cf",
  paperLight: "#f8f1df",
  paperEdge: "#d6cba9",
  white: "#fffdf5",
  pink: "#f4a2be",
  blue: "#80c4cf",
  yellow: "#e8bc5a",
  green: "#a4b785",
  greenDeep: "#7d9a68",
  teal: "#9ccfc4",
  plum: "#8b2150",
  background: "#e8e0c0",
} as const;

export const NUMBER_FONT = '"Courier New", Courier, monospace';
export const LABEL_FONT =
  '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", Arial, sans-serif';

let grainTexture: THREE.CanvasTexture | undefined;

/** Shared paper-fibre bump texture. Presentation only: never used for game state. */
export function paperGrain(): THREE.CanvasTexture {
  if (grainTexture) return grainTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#808080";
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 5200; i++) {
      const shade = 96 + Math.floor(Math.random() * 64);
      context.fillStyle = `rgba(${shade},${shade},${shade},0.35)`;
      context.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4);
    }
    context.lineWidth = 0.7;
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const angle = Math.random() * Math.PI;
      const length = 5 + Math.random() * 12;
      const shade = Math.random() > 0.5 ? 150 : 100;
      context.strokeStyle = `rgba(${shade},${shade},${shade},0.3)`;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length,
      );
      context.stroke();
    }
  }
  grainTexture = new THREE.CanvasTexture(canvas);
  grainTexture.wrapS = THREE.RepeatWrapping;
  grainTexture.wrapT = THREE.RepeatWrapping;
  return grainTexture;
}

export type CanvasPainter = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

/** Draws a label once into a canvas texture and frees it with the component. */
export function useCanvasTexture(
  painter: CanvasPainter,
  width: number,
  height: number,
  deps: readonly unknown[],
): THREE.CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(width));
    canvas.height = Math.max(2, Math.round(height));
    const context = canvas.getContext("2d");
    if (context) painter(context, canvas.width, canvas.height);
    const created = new THREE.CanvasTexture(canvas);
    created.colorSpace = THREE.SRGBColorSpace;
    created.anisotropy = 8;
    return created;
    // The painter is rebuilt each render; `deps` lists what it actually reads.
  }, [width, height, ...deps]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}
