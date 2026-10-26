// Turtle geometry and automatic fit (CAL-1273). Browser-free: interpretTurtle + fitTransform are pure.
import { describe, expect, it } from "vitest";
import { Vector } from "../src/javascripts/lsystem/model";
import { presets } from "../src/javascripts/lsystem/presets";
import { applyTransform, fitTransform, mergeBounds, paddingFor, validateRenderSettings } from "../src/javascripts/lsystem/fit";
import { forestStart, interpretTurtle, type Bounds } from "../src/javascripts/lsystem/turtle";
import { expand, seeded } from "./helpers";

// CSS-pixel canvas sizes (width x 85% of height), mobile portrait/landscape, tablet and desktop.
const CANVASES: [string, number, number][] = [
  ["mobile 375x567", 375, 667 * 0.85],
  ["mobile-landscape 667x319", 667, 375 * 0.85],
  ["tablet 768x870", 768, 1024 * 0.85],
  ["desktop 1280x680", 1280, 800 * 0.85],
  ["wide 1920x918", 1920, 1080 * 0.85],
];
const EPS = 1e-6;

function tree(name: string, iterations: number, opts: { axiom?: string; theta?: number } = {})
{
  const p = presets.find(x => x.name === name)!;
  const rs = opts.axiom ? { ...p, start: opts.axiom } : p;
  const { current, len } = expand(rs as typeof p, iterations, seeded(7));
  return interpretTurtle(current, len, opts.theta ?? p.theta);
}

function expectFitted(bounds: Bounds, w: number, h: number)
{
  const t = fitTransform(bounds, w, h)!;
  expect(t).not.toBeNull();
  const pad = paddingFor(w, h);
  const [x0, y0] = applyTransform(t, bounds.minX, bounds.minY);
  const [x1, y1] = applyTransform(t, bounds.maxX, bounds.maxY);
  expect(x0).toBeGreaterThanOrEqual(pad - EPS);
  expect(y0).toBeGreaterThanOrEqual(pad - EPS);
  expect(x1).toBeLessThanOrEqual(w - pad + EPS);
  expect(y1).toBeLessThanOrEqual(h - pad + EPS);
  expect((x0 + x1) / 2).toBeCloseTo(w / 2, 6); // centred
  expect((y0 + y1) / 2).toBeCloseTo(h / 2, 6);
  // Tight: the limiting dimension fills the padded area.
  const fillX = (x1 - x0) / (w - 2 * pad), fillY = (y1 - y0) / (h - 2 * pad);
  expect(Math.max(fillX, fillY)).toBeCloseTo(1, 6);
  return t;
}

describe("interpretTurtle", () => {
  it("keeps full precision (no 2 dp rounding)", () => {
    const { lines, bounds } = interpretTurtle("+F", 1, 45);
    expect(lines[0].end.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(lines[0].end.x).not.toBe(0.71);
    expect(bounds!.maxX).toBe(lines[0].end.x);
  });
  it("bounds cover drawn segments only, including negative coordinates", () => {
    const { bounds } = interpretTurtle("fF-F", 10, 90); // the move is not drawn
    expect(bounds!.minX).toBeCloseTo(-10, 9); expect(bounds!.maxX).toBeCloseTo(0, 9);
    expect(bounds!.minY).toBeCloseTo(-20, 9); expect(bounds!.maxY).toBeCloseTo(-10, 9);
  });
  it("returns null bounds when nothing is drawn", () => {
    expect(interpretTurtle("", 10, 90).bounds).toBeNull();
    expect(interpretTurtle("fff+-[]", 10, 90).bounds).toBeNull();
  });
  it("keeps leaf and branch metadata", () => {
    const { lines } = interpretTurtle("F[+F][-F]", 10, 30);
    expect(lines.map(l => l.leaf)).toEqual([false, true, true]);
    expect(lines.map(l => l.branchStart)).toEqual([false, true, true]);
  });
  it("honours fractional angles", () => {
    const { lines } = interpretTurtle("+F", 10, 22.5);
    expect(Math.atan2(lines[0].end.y - lines[0].start.y, lines[0].end.x - lines[0].start.x)).toBeCloseTo((270 + 22.5) * Math.PI / 180 - 2 * Math.PI, 10);
  });
});

describe("fitTransform", () => {
  const unit: Bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
  it("returns null for empty, non-finite or invalid input", () => {
    expect(fitTransform(null, 100, 100)).toBeNull();
    expect(fitTransform({ minX: NaN, maxX: 1, minY: 0, maxY: 1 }, 100, 100)).toBeNull();
    expect(fitTransform({ minX: 0, maxX: Infinity, minY: 0, maxY: 1 }, 100, 100)).toBeNull();
    expect(fitTransform(unit, 0, 100)).toBeNull();
    expect(fitTransform(unit, 100, 100, 0)).toBeNull();
    expect(fitTransform(unit, 100, 100, -2)).toBeNull();
    expect(fitTransform(unit, 100, 100, NaN)).toBeNull();
  });
  it("handles a single point and zero-width / zero-height drawings", () => {
    const p = fitTransform({ minX: 3, maxX: 3, minY: 4, maxY: 4 }, 200, 100)!;
    expect(p.scale).toBe(1);
    expect(applyTransform(p, 3, 4)).toEqual([100, 50]);
    expectFitted(interpretTurtle("F", 10, 90).bounds!, 375, 567); // vertical line
    expectFitted(interpretTurtle("+F", 10, 90).bounds!, 375, 567); // horizontal line
  });
  it("manual scale is honoured and only centres", () => {
    const t = fitTransform(unit, 200, 100, 3)!;
    expect(t.scale).toBe(3);
    expect(applyTransform(t, 5, 5)).toEqual([100, 50]);
  });
  it("is independent of earlier calls (pure, no accumulation)", () => {
    expect(fitTransform(unit, 300, 200)).toEqual(fitTransform(unit, 300, 200));
  });
});

describe("validateRenderSettings", () => {
  const ok = { length: 250, scale: 1, factor: 4, theta: 90 };
  it("accepts valid settings", () => expect(validateRenderSettings(ok)).toEqual([]));
  it("rejects non-positive or non-finite values", () => {
    expect(validateRenderSettings({ ...ok, length: 0 })).toHaveLength(1);
    expect(validateRenderSettings({ ...ok, scale: -1 })).toHaveLength(1);
    expect(validateRenderSettings({ ...ok, factor: NaN })).toHaveLength(1);
    expect(validateRenderSettings({ ...ok, theta: Infinity })).toHaveLength(1);
  });
});

describe("presets honour their own length-reduction factor", () => {
  it("every preset factor is positive and finite (all are 4, so appearance is unchanged)", () => {
    for (const p of presets) { expect(p.factor).toBeGreaterThan(0); expect(Number.isFinite(p.factor)).toBe(true); }
  });
  it("a different factor changes the geometry scale", () => {
    const p = presets.find(x => x.name === "Koch Island")!;
    const a = expand(p, 2).len, b = expand({ ...p, factor: 2 } as typeof p, 2).len;
    expect(b / a).toBeCloseTo(4, 10);
  });
});

describe.each(CANVASES)("auto fit on %s", (_n, w, h) => {
  const CASES: [string, string, number, { theta?: number; axiom?: string }?][] = [
    ["branching", "Fractal Plant 2", 4],
    ["branching (stochastic)", "Fractal Plant 8", 3],
    ["curve", "Hilbert Curve", 4],
    ["curve", "Gosper Curve", 3],
    ["polar / rotated", "Pentigree Curve", 3],
    ["polar / rotated", "Star", 3],
    ["rotated by fractional angle", "Koch Island", 2, { theta: 37.5 }],
    ["long / thin", "Koch Curve 1", 1, { axiom: "F++F++F++F++F++F++F++F++F++F++F++F" }],
  ];
  it.each(CASES)("%s: %s fits, is centred and keeps proportions", (_k, name, it, opts) => {
    const { lines, bounds } = tree(name, it, opts);
    expect(lines.length).toBeGreaterThan(0);
    const t = expectFitted(bounds!, w, h);
    // Uniform scale: every segment keeps its length ratio.
    const L = (i: number) => Math.hypot(lines[i].end.x - lines[i].start.x, lines[i].end.y - lines[i].start.y);
    const [ax, ay] = applyTransform(t, lines[0].start.x, lines[0].start.y), [bx, by] = applyTransform(t, lines[0].end.x, lines[0].end.y);
    expect(Math.hypot(bx - ax, by - ay) / L(0)).toBeCloseTo(t.scale, 9);
  });

  it("long thin drawing (axiom of 200 straight segments) fits", () => {
    const { bounds } = interpretTurtle("+" + "F".repeat(200), 5, 90);
    expectFitted(bounds!, w, h);
  });

  it("multi-tree forest fits as one scene", () => {
    const random = seeded(11);
    const all: (Bounds | null)[] = [];
    const p = presets.find(x => x.name === "Fractal Plant 2")!;
    for (let i = 0; i < 5; i++) {
      const { current, len } = expand(p, 3, random);
      all.push(interpretTurtle(current, len, p.theta, forestStart(w, h, 5, i, random)).bounds);
    }
    const merged = mergeBounds(all)!;
    for (const b of all) { expect(b!.minX).toBeGreaterThanOrEqual(merged.minX); expect(b!.maxY).toBeLessThanOrEqual(merged.maxY); }
    expectFitted(merged, w, h);
  });

  it("fit result does not depend on where the drawing starts (no drift)", () => {
    const a = interpretTurtle("F[+F]F[-F]F", 10, 25, new Vector(0, 0));
    const b = interpretTurtle("F[+F]F[-F]F", 10, 25, new Vector(5000, -3000));
    const ta = fitTransform(a.bounds, w, h)!, tb = fitTransform(b.bounds, w, h)!;
    expect(tb.scale).toBeCloseTo(ta.scale, 9);
    const [x, y] = applyTransform(ta, a.lines[2].end.x, a.lines[2].end.y);
    const [x2, y2] = applyTransform(tb, b.lines[2].end.x, b.lines[2].end.y);
    expect(x2).toBeCloseTo(x, 6); expect(y2).toBeCloseTo(y, 6);
  });
});

describe("every preset fits at mobile and desktop sizes", () => {
  for (const p of presets) {
    it(p.name, () => {
      const { current, len } = expand(p, 3, seeded(3));
      const { bounds } = interpretTurtle(current, len, p.theta);
      if (!bounds) return; // a preset that draws nothing at this depth is handled by the null path
      expectFitted(bounds, 375, 567);
      expectFitted(bounds, 1280, 680);
    });
  }
});
