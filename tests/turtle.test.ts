import { describe, expect, it } from "vitest";
import { Bounds, CentreOffset, Line, RotateTransform, StartPosition, Transform, Vector } from "../src/javascripts/lsystem";
import { lSystems } from "../src/javascripts/presets";
import { Rewrite } from "../src/javascripts/lsystem";
import { segments, sequence, trace } from "./helpers";

describe("turtle: commands", () =>
{
  it("starts heading up the canvas (270 degrees, y decreases)", () =>
  {
    expect(segments(trace("F", 90, 10, 100, 100).lines)).toEqual([[100, 100, 100, 90]]);
  });

  it("draws a segment for both F and G", () =>
  {
    let { lines } = trace("FG");
    expect(lines).toHaveLength(2);
    expect(segments(lines)).toEqual([[0, 0, 0, -10], [0, -10, 0, -20]]);
  });

  it("moves without drawing for f", () =>
  {
    let { lines, bounds } = trace("fF");
    expect(segments(lines)).toEqual([[0, -10, 0, -20]]);
    // the move alone does not widen the bounds, only drawn segments do
    expect(trace("ff").bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
    expect(bounds.minY).toBe(-20);
  });

  it("rotates clockwise for + and anticlockwise for -", () =>
  {
    expect(segments(trace("+F", 90).lines)).toEqual([[0, 0, 10, 0]]); // right
    expect(segments(trace("-F", 90).lines)).toEqual([[0, 0, -10, 0]]); // left
    expect(segments(trace("++F", 90).lines)).toEqual([[0, 0, 0, 10]]); // down
  });

  it("returns to the same heading after four quarter turns either way", () =>
  {
    expect(segments(trace("++++F", 90).lines)).toEqual(segments(trace("F").lines));
    expect(segments(trace("----F", 90).lines)).toEqual(segments(trace("F").lines));
  });

  it("rounds coordinates to two decimal places", () =>
  {
    let [line] = trace("+F", 45, 10).lines;
    expect(line.end.x).toBe(7.07);
    expect(line.end.y).toBe(-7.07);
  });

  it("stores the heading of each segment", () =>
  {
    expect(trace("F+F", 90).lines.map(l => l.rot)).toEqual([270, 360]);
  });

  it("saves and restores position and heading with [ and ]", () =>
  {
    let { lines } = trace("F[+F]F", 90);
    expect(segments(lines)).toEqual([[0, 0, 0, -10], [0, -10, 10, -10], [0, -10, 0, -20]]);
  });

  it("supports nested branches", () =>
  {
    let { lines } = trace("[F[+F]-F]F", 90);
    expect(segments(lines)).toEqual([
      [0, 0, 0, -10],
      [0, -10, 10, -10],
      [0, -10, -10, -10],
      [0, 0, 0, -10],
    ]);
  });

  it("ignores a ] with nothing to restore and unknown characters", () =>
  {
    expect(segments(trace("]F]XYZ0 1", 90).lines)).toEqual([[0, 0, 0, -10]]);
  });

  it("leaves unclosed [ harmlessly", () =>
  {
    expect(trace("F[F[F").lines).toHaveLength(3);
  });

  it("returns no lines for an empty string or one without F/G", () =>
  {
    expect(trace("").lines).toEqual([]);
    expect(trace("f+-[]").lines).toEqual([]);
  });

  it("scales by the segment length", () =>
  {
    expect(segments(trace("F", 90, 250).lines)).toEqual([[0, 0, 0, -250]]);
    expect(segments(trace("F", 90, 0).lines)).toEqual([[0, 0, 0, 0]]);
  });

  it("accumulates bounds from segment start and end points", () =>
  {
    let { bounds } = trace("F+F+F", 90);
    expect(bounds).toEqual({ minX: 0, maxX: 10, minY: -10, maxY: 0 });
  });
});

describe("turtle: branch and leaf flags", () =>
{
  it("marks the last segment before ] and the final segment as leaves", () =>
  {
    let { lines } = trace("F[+F]F", 90);
    expect(lines.map(l => l.leaf)).toEqual([false, true, true]);
  });

  it("marks segments sharing a start point as branch starts", () =>
  {
    let { lines } = trace("F[+F]F", 90);
    expect(lines.map(l => l.branchStart)).toEqual([false, true, true]);
  });
});

describe("turtle: rotation", () =>
{
  it("wraps below zero", () =>
  {
    let t = new Transform(new Vector(0, 0), 10);
    RotateTransform(t, -30);
    expect(t.rot).toBe(340);
  });

  it("returns a copy carrying the new heading", () =>
  {
    let t = new Transform(new Vector(1, 2), 0);
    let result = RotateTransform(t, 45);
    expect(result.rot).toBe(45);
    expect(result.pos).toEqual({ x: 1, y: 2 });
    expect(result.pos).not.toBe(t.pos);
  });

  it("handles non-integer angles", () =>
  {
    let t = new Transform(new Vector(0, 0), 0);
    RotateTransform(t, 22.5);
    RotateTransform(t, 22.5);
    expect(t.rot).toBe(45);
  });
});

describe("turtle: bracket balance across presets", () =>
{
  function depthOk(s: string): boolean
  {
    let depth = 0;
    for(let c of s)
    {
      if(c === "[") depth++;
      if(c === "]") depth--;
      if(depth < 0) return false;
    }
    return depth === 0;
  }

  it.each(lSystems.map(p => [p.name, p] as const))("%s keeps [ ] balanced at depths 0 to 3", (_name, rs) =>
  {
    let current = rs.start;
    expect(depthOk(current)).toBe(true);
    for(let i = 0; i < 3; i++)
    {
      current = Rewrite(rs, current, () => 0.5);
      expect(depthOk(current)).toBe(true);
    }
  });

  it("keeps stochastic Fractal Plant 8 balanced for many random draws", () =>
  {
    let plant8 = lSystems[27];
    for(let v = 0; v < 1; v += 0.05)
    {
      expect(depthOk(Rewrite(plant8, Rewrite(plant8, "F", () => v), () => v))).toBe(true);
    }
  });
});

describe("forest placement", () =>
{
  it("starts a normal tree at the canvas centre without drawing randomness", () =>
  {
    expect(StartPosition(1280, 680, false, 5, 3, sequence())).toEqual({ x: 640, y: 340 });
  });

  it("rounds the centre to two decimals", () =>
  {
    expect(StartPosition(1001, 333, false, 1, 0, sequence())).toEqual({ x: 500.5, y: 166.5 });
  });

  it("puts every forest tree on the bottom edge", () =>
  {
    expect(StartPosition(1000, 600, true, 5, 2, sequence(0.5, 0.9)).y).toBe(600);
  });

  it("offsets by floor(rand * width*0.8/count) * index, to the right when the second draw is below 0.5", () =>
  {
    // divide = 1000 * 0.8 / 4 = 200; floor(0.5 * 200) * 3 = 300
    expect(StartPosition(1000, 600, true, 4, 3, sequence(0.5, 0.25)).x).toBe(800);
    expect(StartPosition(1000, 600, true, 4, 3, sequence(0.5, 0.5)).x).toBe(200);
  });

  it("always places the first tree at the centre", () =>
  {
    expect(StartPosition(1000, 600, true, 4, 0, sequence(0.99, 0.1)).x).toBe(500);
  });

  it("draws exactly two random numbers per forest tree and none otherwise", () =>
  {
    expect(() => StartPosition(1000, 600, true, 4, 1, sequence(0.1))).toThrow("exhausted");
    expect(() => StartPosition(1000, 600, false, 4, 1, sequence())).not.toThrow();
  });

  it("keeps trees inside +-80% of the width of the centre line for the largest valid count", () =>
  {
    // the Count input allows up to 25 trees; the farthest tree is index 24 with rand just under 1
    let x = StartPosition(1000, 600, true, 25, 24, sequence(0.9999, 0.1)).x;
    expect(x).toBeLessThanOrEqual(500 + 1000 * 0.8 * 24 / 25);
  });
});

describe("centring", () =>
{
  it("offsets so the first segment start lands where the bounding box centre puts it", () =>
  {
    let bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 50 };
    let first = new Line(new Vector(60, 50), new Vector(60, 40));
    // (100-0)/2 - (100-60) = 10 ; (50-0)/2 - (50-50) = 25
    expect(CentreOffset(bounds, first)).toEqual({ x: 10, y: 25 });
  });
});
