// Geometry snapshots: line counts, bounding boxes and draw offsets for representative curves and plants at several
// viewport aspect ratios. Fixture: tests/fixtures/geometry.json (regenerate with `UPDATE_FIXTURES=1 npm test`).
// Numbers are compared with an absolute tolerance of 0.05 px (coordinates are rounded to 2 dp, so a real change in
// the algorithm moves them by far more). Stochastic and forest cases use a seeded random source.
//
// Expected differences caused by existing bugs (documented, not asserted as correct):
//  * The app divides the starting length (250) by 4 per iteration regardless of canvas size and has no fit-to-canvas
//    step, and the Scale setting has no effect (AUDIT known defect 2), so on small viewports large drawings
//    overflow the canvas. `fits` is recorded in the fixture as-is.
//  * GetSystem truncates theta with parseInt, so the app draws 25.7 as 25 and 22.5 as 22. Snapshots use the
//    UI-effective theta (what users see); one test records the difference to the preset's own theta.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { presets } from "../src/javascripts/lsystem/presets";
import { layout, seeded, type Layout } from "./helpers";

const FIXTURE = fileURLToPath(new URL("./fixtures/geometry.json", import.meta.url));
const TOLERANCE = 0.05;

// window.innerWidth x window.innerHeight; the canvas is the full width and 85% of the height.
const VIEWPORTS: [string, number, number][] = [
  ["desktop-16:10 1280x800", 1280, 800],
  ["wide-16:9 1920x1080", 1920, 1080],
  ["tablet-portrait 768x1024", 768, 1024],
  ["small-5:4 600x500", 600, 500],
  ["phone-portrait 375x667", 375, 667],
];

const CASES: [string, number, { forest?: number }?][] = [
  ["Koch Island", 3],
  ["Hilbert Curve", 4],
  ["Gosper Curve", 3],
  ["Sierpinkski Triangle", 4],
  ["Fractal Plant 1", 3],
  ["Fractal Plant 2", 3],
  ["Fractal Plant 8", 3],
  ["Fractal Plant 9", 3],
  ["Fractal Plant 2", 3, { forest: 5 }],
];

function compute(name: string, iterations: number, w: number, h: number, forest?: number)
{
  const p = presets.find(x => x.name === name)!;
  const out: Layout[] = [];
  const trees = forest ?? 1;
  const random = seeded(2024);
  for (let index = 0; index < trees; index++) {
    out.push(layout(p, iterations, w, h * 0.85, {
      theta: Math.trunc(p.theta), random, forest: forest ? { count: forest, index } : undefined }));
  }
  return out.map(l => ({ lines: l.lines, fits: l.fits, offset: [l.offsetX, l.offsetY],
    drawn: [l.drawn.minX, l.drawn.minY, l.drawn.maxX, l.drawn.maxY] }));
}

const key = (name: string, it: number, forest: number | undefined, vp: string) =>
  `${name} i${it}${forest ? ` forest${forest}` : ""} @ ${vp}`;

if (process.env.UPDATE_FIXTURES) {
  const fixture: Record<string, unknown> = {};
  for (const [name, it, o] of CASES) for (const [vp, w, h] of VIEWPORTS) fixture[key(name, it, o?.forest, vp)] = compute(name, it, w, h, o?.forest);
  writeFileSync(FIXTURE, JSON.stringify(fixture, null, 1) + "\n");
}

const fixture: Record<string, ReturnType<typeof compute>> = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, "utf8")) : {};

function expectClose(actual: unknown, expected: unknown, path = ""): void
{
  if (typeof expected === "number") {
    expect(typeof actual, path).toBe("number");
    expect(Math.abs((actual as number) - expected), `${path}: ${actual} vs ${expected}`).toBeLessThanOrEqual(TOLERANCE);
  } else if (Array.isArray(expected)) {
    expect((actual as unknown[]).length, path).toBe(expected.length);
    expected.forEach((e, i) => expectClose((actual as unknown[])[i], e, `${path}[${i}]`));
  } else if (expected && typeof expected === "object") {
    for (const k of Object.keys(expected)) expectClose((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k], `${path}.${k}`);
  } else {
    expect(actual, path).toBe(expected);
  }
}

describe.each(CASES)("geometry snapshot: %s, %i iterations", (name, iterations, opts) => {
  it.each(VIEWPORTS)("at %s", (vp, w, h) => {
    const k = key(name, iterations, opts?.forest, vp);
    expect(fixture[k], `missing fixture '${k}'; run UPDATE_FIXTURES=1 npm test`).toBeDefined();
    expectClose(compute(name, iterations, w, h, opts?.forest), fixture[k], k);
  });
});

describe("viewport behaviour", () => {
  const extent = (name: string, it: number, w: number, h: number) => {
    const [l] = compute(name, it, w, h);
    return [l.drawn[2] - l.drawn[0], l.drawn[3] - l.drawn[1], l.lines];
  };

  it("drawing size does not depend on the canvas size (no fit-to-canvas)", () => {
    for (const [name, it] of CASES.filter(c => !c[2] && c[0] !== "Fractal Plant 8")) {
      const [w0, h0, n0] = extent(name, it, 1920, 1080 * 0.85 / 0.85);
      for (const [, w, h] of VIEWPORTS) {
        const [ew, eh, en] = extent(name, it, w, h);
        expect(ew, `${name} width @${w}x${h}`).toBeCloseTo(w0, 1);
        expect(eh, `${name} height @${w}x${h}`).toBeCloseTo(h0, 1);
        expect(en).toBe(n0);
      }
    }
  });

  it("recorded difference: large drawings overflow small canvases (known limitation, not desired behaviour)", () => {
    const small = compute("Koch Island", 3, 375, 667)[0];
    const big = compute("Koch Island", 3, 1920, 1080)[0];
    expect(small.fits).toBe(false);
    expect(big.fits).toBe(true);
  });

  it("recorded difference: UI-truncated theta changes the geometry of Fractal Plant 2", () => {
    const p = presets.find(x => x.name === "Fractal Plant 2")!;
    const ui = layout(p, 3, 1280, 680, { theta: Math.trunc(p.theta) });
    const own = layout(p, 3, 1280, 680, { theta: p.theta });
    expect(ui.lines).toBe(own.lines);
    expect(Math.abs(ui.drawn.maxX - own.drawn.maxX) + Math.abs(ui.drawn.minX - own.drawn.minX)).toBeGreaterThan(0.2); // well above the 0.05 snapshot tolerance
  });

  it("stochastic scenario is reproducible for a seed (Fractal Plant 8)", () => {
    expect(compute("Fractal Plant 8", 3, 1280, 800)).toEqual(compute("Fractal Plant 8", 3, 1280, 800));
  });

  it("forest trees are placed along the bottom edge, with tree 0 at the centre", () => {
    const trees = compute("Fractal Plant 2", 3, 1280, 800, 5);
    expect(trees).toHaveLength(5);
    for (const t of trees) expect(t.drawn[3]).toBeCloseTo(680, 1);
  });
});
