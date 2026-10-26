import { Colour, Line, Vector } from "./model";
import type { RandomSource } from "./rewrite";
import { mergeBounds } from "./fit";
import { forestStart, interpretTurtle, type Bounds } from "./turtle";

// Upper bound on drawable segments in one scene (all trees together); beyond it the main thread would stall.
export const MAX_SEGMENTS = 400_000;
// Generations longer than this are shown in sections of this size in the output panel (the full string is kept and drawn).
export const MAX_DISPLAY_CHARS = 20_000;

export class SegmentLimitError extends Error
{
  constructor(public readonly count: number)
  {
    super(`The drawing has more than ${MAX_SEGMENTS.toLocaleString()} segments.`);
    this.name = "SegmentLimitError";
  }
}

// Everything needed to draw one tree, fixed at generation time so that a redraw (e.g. after a resize)
// reproduces exactly the same picture. Colours and leaf jitter are drawn once, from the random source.
export interface TreeScene
{
  lines: Line[];
  bounds: Bounds | null;
  colours: string[];          // per segment, "rgb(r,g,b)"
  leafAt: Uint8Array;         // 1 where a leaf is drawn at the segment end (leaf flag and no segment starts there)
  leafJitter: Float32Array;   // 2 values per segment: random additions to the leaf radii
}

export interface Scene
{
  trees: TreeScene[];
  bounds: Bounds | null;      // aggregate bounds of all trees
  segments: number;
}

export interface TreeInput { generation: string; length: number; start: Vector; }

export interface ColourOptions { base: Colour; variance: number; }

// Random walk of the colour along the segments (moved from main.ts RandomColour; state is per tree).
export function walkColours(count: number, opts: ColourOptions, random: RandomSource = Math.random): string[]
{
  const out: string[] = new Array(count);
  let r = opts.base.r, g = opts.base.g, b = opts.base.b;
  const clamp = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v;
  for (let i = 0; i < count; i++)
  {
    const vr = Math.floor(random() * opts.variance);
    const vg = Math.floor(random() * opts.variance);
    const vb = Math.floor(random() * opts.variance);
    const sign = random() > 0.5 ? 1 : -1;
    r = clamp(r + sign * vr); g = clamp(g + sign * vg); b = clamp(b + sign * vb);
    out[i] = "rgb(" + r + "," + g + "," + b + ")";
  }
  return out;
}

// Leaves are drawn at the end of a leaf segment unless another segment starts there. One pass with a Set: O(n).
export function leafMask(lines: Line[]): Uint8Array
{
  const mask = new Uint8Array(lines.length);
  let any = false;
  for (const l of lines) if (l.leaf) { any = true; break; }
  if (!any) return mask;
  const starts = new Set<string>();
  for (const l of lines) starts.add(l.start.x + "," + l.start.y);
  for (let i = 0; i < lines.length; i++)
    if (lines[i].leaf && !starts.has(lines[i].end.x + "," + lines[i].end.y)) mask[i] = 1;
  return mask;
}

export function buildTree(input: TreeInput, theta: number, colour: ColourOptions, random: RandomSource = Math.random): TreeScene
{
  const traced = interpretTurtle(input.generation, input.length, theta, input.start);
  const lines = traced.lines;
  const leafAt = leafMask(lines);
  const leafJitter = new Float32Array(lines.length * 2);
  for (let i = 0; i < lines.length; i++)
    if (leafAt[i]) { leafJitter[2 * i] = random(); leafJitter[2 * i + 1] = random(); }
  return { lines, bounds: traced.bounds, colours: walkColours(lines.length, colour, random), leafAt, leafJitter };
}

// Builds every tree. Each tree has its own start point (forest trees are spread along the canvas width,
// chosen once here) and its own bounds, lines and colours. Throws SegmentLimitError past MAX_SEGMENTS.
export function buildScene(finals: { generation: string; length: number }[], theta: number, forest: boolean,
  canvasWidth: number, canvasHeight: number, colour: ColourOptions, random: RandomSource = Math.random): Scene
{
  const trees: TreeScene[] = [];
  let segments = 0;
  finals.forEach((f, index) =>
  {
    const start = forest ? forestStart(canvasWidth, canvasHeight, finals.length, index, random) : new Vector(0, 0);
    const tree = buildTree({ generation: f.generation, length: f.length, start }, theta, colour, random);
    segments += tree.lines.length;
    if (segments > MAX_SEGMENTS) throw new SegmentLimitError(segments);
    trees.push(tree);
  });
  return { trees, bounds: mergeBounds(trees.map(t => t.bounds)), segments };
}

// Text for the output panel: long generations are cut so the DOM stays small.
export function displayText(generation: string): string
{
  if (generation.length <= MAX_DISPLAY_CHARS) return generation;
  return generation.slice(0, MAX_DISPLAY_CHARS) + `… (${(generation.length - MAX_DISPLAY_CHARS).toLocaleString()} more symbols not shown)`;
}

// Progressive inspection: the next section of a generation, starting at `shown` symbols already displayed.
// Nothing is discarded; the caller keeps the full string and asks for more until `remaining` is 0.
export function nextSection(generation: string, shown: number, size: number = MAX_DISPLAY_CHARS): { text: string; shown: number; remaining: number }
{
  const end = Math.min(generation.length, shown + size);
  return { text: generation.slice(shown, end), shown: end, remaining: generation.length - end };
}
