import { RuleSet, Vector } from "../src/javascripts/lsystem/model";
import { rewrite, type RandomSource } from "../src/javascripts/lsystem/rewrite";
import { drawOffset, initialBounds } from "../src/javascripts/lsystem/layout";
import { forestStart, traceLines, type Bounds } from "../src/javascripts/lsystem/turtle";

// mulberry32: small seeded PRNG so stochastic scenarios are reproducible. No end-user seed UI is implied.
export function seeded(seed: number): RandomSource
{
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A random source that returns the given values in order, then throws (so unexpected extra draws fail loudly).
export function scripted(...values: number[]): RandomSource
{
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("scripted random source exhausted");
    return values[i++];
  };
}

// Expands like main.ts Initiate: `iterations` generations, length divided by the factor each time.
export function expand(rs: RuleSet, iterations: number, random: RandomSource = Math.random)
{
  let current = rs.start;
  let len = 250;
  const generations = [current];
  for (let i = 0; i < iterations; i++) {
    len /= rs.factor;
    current = rewrite(rs, current, random);
    generations.push(current);
  }
  return { current, len, generations };
}

export interface Layout {
  lines: number;
  bounds: Bounds;
  offsetX: number;
  offsetY: number;
  // Drawn extent after the offset, in canvas pixels.
  drawn: { minX: number; maxX: number; minY: number; maxY: number };
  fits: boolean;
}

// Mirrors the geometry part of main.ts Initiate/GetLines/Draw for one tree on a canvas of the given size
// (window.innerWidth x window.innerHeight * 0.85), using the same layout.ts functions as main.ts.
export function layout(rs: RuleSet, iterations: number, canvasW: number, canvasH: number,
  opts: { theta?: number; random?: RandomSource; forest?: { count: number; index: number } } = {}): Layout
{
  const random = opts.random ?? Math.random;
  const { current, len } = expand(rs, iterations, random);
  const bounds: Bounds = initialBounds(canvasW, canvasH);
  const start = opts.forest
    ? forestStart(canvasW, canvasH, opts.forest.count, opts.forest.index, random)
    : new Vector(parseFloat((canvasW / 2).toFixed(2)), parseFloat((canvasH / 2).toFixed(2)));
  const lines = traceLines(current, len, opts.theta ?? rs.theta, start, bounds);
  let offsetX = 0, offsetY = 0;
  if (!opts.forest && lines.length > 0) {
    ({ offsetX, offsetY } = drawOffset(bounds, lines[0]));
  }
  const drawn = { minX: bounds.minX + offsetX, maxX: bounds.maxX + offsetX, minY: bounds.minY + offsetY, maxY: bounds.maxY + offsetY };
  const fits = drawn.minX >= 0 && drawn.maxX <= canvasW && drawn.minY >= 0 && drawn.maxY <= canvasH;
  return { lines: lines.length, bounds, offsetX, offsetY, drawn, fits };
}
