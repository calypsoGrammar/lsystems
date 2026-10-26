import type { Bounds } from "./turtle";

// Uniform, aspect-preserving mapping from logical turtle coordinates to canvas CSS pixels:
// x' = x * scale + tx, y' = y * scale + ty. Pure and browser-free.
export interface ViewTransform { scale: number; tx: number; ty: number; }

export const PADDING_FRACTION = 0.05; // of the shorter canvas side
export const MIN_PADDING_PX = 8;
const EPSILON = 1e-9; // extents below this are treated as zero (a point or a perfectly straight line)

export function paddingFor(width: number, height: number): number
{
  const shorter = Math.min(width, height);
  return Math.min(Math.max(MIN_PADDING_PX, shorter * PADDING_FRACTION), shorter / 4);
}

export function mergeBounds(all: (Bounds | null)[]): Bounds | null
{
  let out: Bounds | null = null;
  for (const b of all)
  {
    if (b === null) continue;
    out = out === null ? { ...b } : {
      minX: Math.min(out.minX, b.minX), maxX: Math.max(out.maxX, b.maxX),
      minY: Math.min(out.minY, b.minY), maxY: Math.max(out.maxY, b.maxY) };
  }
  return out;
}

function finiteBounds(b: Bounds | null): b is Bounds
{
  return b !== null && [b.minX, b.maxX, b.minY, b.maxY].every(Number.isFinite) && b.maxX >= b.minX && b.maxY >= b.minY;
}

// Centres `bounds` in a width x height canvas. With `scale` omitted the largest scale that fits inside the
// padding is used (auto fit); with a positive finite `scale` that scale is used and the drawing is only centred.
// Returns null for empty/non-finite bounds, a non-positive canvas or an invalid scale.
export function fitTransform(bounds: Bounds | null, width: number, height: number, scale?: number, padding?: number): ViewTransform | null
{
  if (!finiteBounds(bounds) || !(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (scale !== undefined && !(scale > 0 && Number.isFinite(scale))) return null;

  const pad = padding ?? paddingFor(width, height);
  const bw = bounds.maxX - bounds.minX, bh = bounds.maxY - bounds.minY;
  let s = scale;
  if (s === undefined)
  {
    const fits: number[] = [];
    if (bw > EPSILON) fits.push((width - 2 * pad) / bw);
    if (bh > EPSILON) fits.push((height - 2 * pad) / bh);
    s = fits.length > 0 ? Math.min(...fits) : 1; // a single point: draw at 1:1
  }
  if (!(s > 0) || !Number.isFinite(s)) return null;

  return {
    scale: s,
    tx: width / 2 - s * (bounds.minX + bounds.maxX) / 2,
    ty: height / 2 - s * (bounds.minY + bounds.maxY) / 2,
  };
}

export function applyTransform(t: ViewTransform, x: number, y: number): [number, number]
{
  return [x * t.scale + t.tx, y * t.scale + t.ty];
}

export interface RenderSettings { length: number; scale: number; factor: number; theta: number; }

// Returns human-readable problems; empty when the settings can be used.
export function validateRenderSettings(s: RenderSettings): string[]
{
  const problems: string[] = [];
  if (!(s.length > 0 && Number.isFinite(s.length))) problems.push("Starting length must be a positive number.");
  if (!(s.scale > 0 && Number.isFinite(s.scale))) problems.push("Scale must be a positive number.");
  if (!(s.factor > 0 && Number.isFinite(s.factor))) problems.push("Length reduction factor must be a positive number.");
  if (!Number.isFinite(s.theta)) problems.push("Theta must be a number.");
  return problems;
}
