import { describe, expect, it } from "vitest";
import { Bounds, CentreOffset, Rewrite, RuleSet, StartPosition, TraceTurtle } from "../src/javascripts/lsystem";
import { lSystems } from "../src/javascripts/presets";
import { seeded } from "./helpers";

// Geometry snapshots stand in for pixel screenshots: they follow the same maths as the
// app (Initiate, GetLines, Draw) for a given window size, with no canvas.
//
// Tolerance: every number is rounded to a whole pixel before it is compared with the
// snapshot, so a change under half a pixel is ignored and a larger one fails.
//
// Expected differences caused by existing bugs (docs/AUDIT.md), recorded not endorsed:
//  - The drawing is not scaled to the canvas: the start length is 250 px divided by 4 per
//    iteration whatever the viewport, so `fits` is false when a figure is larger than a
//    small canvas, and the same figure is simply clipped.
//  - The UI truncates theta with parseInt, so 25.7 draws as 25 and 22.5 as 22. The layout
//    below does the same, because that is what the user sees.
//  - Scale (canvas size) has no visible effect, so it is not modelled.
//  - Dragon Curve and Fractal Plant 7 grow far less than their real-world counterparts.
const VIEWPORTS: [string, number, number][] = [
  ["desktop 1280x800", 1280, 800],
  ["small 600x500", 600, 500],
  ["portrait phone 390x844", 390, 844],
  ["ultrawide 2560x600", 2560, 600],
];

interface Layout
{
  canvas: [number, number];
  lines: number;
  bounds: number[];
  offset: number[];
  fits: boolean;
}

function round(v: number): number
{
  return Math.round(v) + 0; // + 0 turns -0 into 0
}

function layout(rs: RuleSet, width: number, height: number, iterations: number): Layout
{
  let canvasW = width;
  let canvasH = height * 0.85;
  let current = rs.start;
  let len = 250;
  let random = seeded(1);
  for(let i = 0; i < iterations; i++)
  {
    len /= rs.factor;
    current = Rewrite(rs, current, random);
  }
  let start = StartPosition(canvasW, canvasH, false, 1, 0);
  let bounds: Bounds = { minX: start.x, maxX: start.x, minY: start.y, maxY: start.y };
  let lines = TraceTurtle(current, parseInt(String(rs.theta)), len, start, bounds);
  let offset = CentreOffset(bounds, lines[0]);
  let fits = bounds.minX + offset.x >= 0 && bounds.maxX + offset.x <= canvasW
    && bounds.minY + offset.y >= 0 && bounds.maxY + offset.y <= canvasH;
  return {
    canvas: [round(canvasW), round(canvasH)],
    lines: lines.length,
    bounds: [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].map(round),
    offset: [offset.x, offset.y].map(round),
    fits,
  };
}

describe("geometry snapshots", () =>
{
  it.each(lSystems.map(p => [p.name, p] as const))("%s at 2 iterations in every viewport", (_name, rs) =>
  {
    let result: Record<string, Layout> = {};
    for(let [label, w, h] of VIEWPORTS) result[label] = layout(rs, w, h, 2);
    expect(result).toMatchSnapshot();
  });

  it("gives viewport-independent shape: only the offset depends on the canvas size", () =>
  {
    for(let rs of lSystems)
    {
      let a = layout(rs, 1280, 800, 2);
      let b = layout(rs, 390, 844, 2);
      expect(b.lines).toBe(a.lines);
      // bounds are relative to the canvas centre, so width/height of the figure match
      // each bound is rounded to a pixel, so allow one pixel of difference
      expect(Math.abs((b.bounds[2] - b.bounds[0]) - (a.bounds[2] - a.bounds[0]))).toBeLessThanOrEqual(1);
      expect(Math.abs((b.bounds[3] - b.bounds[1]) - (a.bounds[3] - a.bounds[1]))).toBeLessThanOrEqual(1);
    }
  });

  it("reports figures larger than a small canvas as not fitting (existing behaviour)", () =>
  {
    let koch = lSystems[0];
    expect(layout(koch, 1280, 800, 2).fits).toBe(true);
    expect(layout(lSystems[2], 390, 844, 1).fits).toBe(false);
  });
});

describe("edge-case dimensions", () =>
{
  it("handles a zero-sized canvas by centring on the origin", () =>
  {
    let result = layout(lSystems[0], 0, 0, 1);
    expect(result.canvas).toEqual([0, 0]);
    expect(Number.isFinite(result.offset[0])).toBe(true);
    expect(result.fits).toBe(false);
  });

  it("handles a one-pixel canvas", () =>
  {
    let result = layout(lSystems[0], 1, 1, 1);
    expect(result.lines).toBeGreaterThan(0);
    expect(result.offset.every(Number.isFinite)).toBe(true);
  });

  it("handles a huge canvas without losing precision", () =>
  {
    let a = layout(lSystems[0], 100_000, 100_000, 1);
    expect(a.bounds[2] - a.bounds[0]).toBe(layout(lSystems[0], 1280, 800, 1).bounds[2] - layout(lSystems[0], 1280, 800, 1).bounds[0]);
  });

  it("handles a zero-length start by drawing degenerate segments", () =>
  {
    let bounds: Bounds = { minX: 5, maxX: 5, minY: 5, maxY: 5 };
    let lines = TraceTurtle("FF", 90, 0, { x: 5, y: 5 }, bounds);
    expect(lines).toHaveLength(2);
    expect(bounds).toEqual({ minX: 5, maxX: 5, minY: 5, maxY: 5 });
  });

  it("places a seeded forest at reproducible spots in every viewport", () =>
  {
    let spots: Record<string, number[][]> = {};
    for(let [label, w, h] of VIEWPORTS)
    {
      let random = seeded(42);
      let canvasW = w;
      let canvasH = h * 0.85;
      spots[label] = [0, 1, 2, 3, 4].map(i =>
      {
        let p = StartPosition(canvasW, canvasH, true, 5, i, random);
        return [round(p.x), round(p.y)];
      });
    }
    expect(spots).toMatchSnapshot();
  });
});
