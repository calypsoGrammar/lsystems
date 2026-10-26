import { describe, expect, it } from "vitest";
import { Transform, Vector } from "../src/javascripts/lsystem/model";
import { forestStart, RotateTransform, traceLines, type Bounds } from "../src/javascripts/lsystem/turtle";
import { scripted } from "./helpers";

const fresh = (): Bounds => ({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
const trace = (s: string, len = 10, theta = 90, at = new Vector(0, 0), b = fresh()) => traceLines(s, len, theta, at, b);
const pts = (s: string, len?: number, theta?: number) =>
  trace(s, len, theta).map(l => [l.start.x, l.start.y, l.end.x, l.end.y].map(v => v + 0)); // + 0 turns -0 into 0

describe("drawing and moving", () => {
  it("F draws one segment heading up (angle 270, y decreases)", () => {
    expect(pts("F")).toEqual([[0, 0, 0, -10]]);
  });
  it("G draws exactly like F", () => {
    expect(pts("G")).toEqual(pts("F"));
  });
  it("f moves without drawing", () => {
    expect(pts("fF")).toEqual([[0, -10, 0, -20]]);
    expect(trace("fff")).toEqual([]);
  });
  it("ignores unknown symbols", () => {
    expect(pts("XYZ01F")).toEqual(pts("F"));
  });
  it("empty string draws nothing", () => {
    expect(trace("")).toEqual([]);
  });
  it("rounds coordinates to 2 decimal places", () => {
    const [l] = trace("+F", 1, 45);
    expect(l.end.x).toBe(0.71);
    expect(l.end.y).toBe(-0.71);
  });
});

describe("rotation", () => {
  it("+ turns clockwise on screen (up -> right), - turns anticlockwise (up -> left)", () => {
    const [r] = pts("+F"); const [l] = pts("-F");
    expect(r[2]).toBeCloseTo(10); expect(r[3]).toBeCloseTo(0);
    expect(l[2]).toBeCloseTo(-10); expect(l[3]).toBeCloseTo(0);
  });
  it("+ then - cancel", () => {
    expect(pts("+-F")).toEqual(pts("F"));
  });
  it("four 90 degree turns return to the original heading", () => {
    expect(pts("++++F")[0][2]).toBeCloseTo(0);
    expect(pts("++++F")[0][3]).toBeCloseTo(-10);
  });
  it("RotateTransform wraps below zero into 0..360", () => {
    const t = new Transform(new Vector(0, 0), 10);
    RotateTransform(t, -30);
    expect(t.rot).toBe(340);
  });
  it("traces a square with theta 90", () => {
    const l = pts("F+F+F+F");
    expect(l.map(p => [Math.round(p[2]), Math.round(p[3])])).toEqual([[0, -10], [10, -10], [10, 0], [0, 0]]);
  });
});

describe("branching [ ]", () => {
  it("restores position and heading after ]", () => {
    const l = pts("F[+F]F");
    expect(l[2].slice(0, 2)).toEqual([0, -10]);   // third segment starts where the branch started
    expect(l[2][2]).toBeCloseTo(0); expect(l[2][3]).toBeCloseTo(-20);
  });
  it("supports nested branches", () => {
    const l = pts("F[+F[+F]F]F");
    expect(l).toHaveLength(5);
    expect(l[4].slice(0, 2)).toEqual([0, -10]);
  });
  it("ignores an unmatched ] and an unclosed [", () => {
    expect(pts("]F")).toEqual(pts("F"));
    expect(pts("[F")).toEqual(pts("F"));
  });
  it("marks leaf segments (last segment before ], and the final segment)", () => {
    const l = trace("F[+F]F[-F]F");
    expect(l.map(x => x.leaf)).toEqual([false, true, false, true, true]);
  });
  it("marks segments that share a start point as branchStart", () => {
    const l = trace("F[+F]F");
    expect(l.map(x => x.branchStart)).toEqual([false, true, true]);
  });
  it("records the heading of each segment", () => {
    // 270 + 90 is 360, not 0: headings are not wrapped at the top (harmless for trig, see known-defects)
    expect(trace("F+F").map(x => x.rot)).toEqual([270, 360]);
  });
});

describe("bounds", () => {
  it("extend the supplied bounds in place and never shrink them", () => {
    const b: Bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    trace("F+F", 10, 90, new Vector(0, 0), b);
    expect(b).toEqual({ minX: -100, maxX: 100, minY: -100, maxY: 100 });
    const c = fresh();
    trace("F+F", 10, 90, new Vector(0, 0), c);
    expect(c).toEqual({ minX: 0, maxX: 10, minY: -10, maxY: 0 }); // the start point counts
  });
});

describe("edge-case dimensions", () => {
  it("zero length produces zero-length segments at the start point", () => {
    expect(pts("FF", 0)).toEqual([[0, 0, 0, 0], [0, 0, 0, 0]]);
  });
  it("theta 0 never changes the heading; theta 360 is a no-op turn (rounded)", () => {
    expect(pts("+F", 10, 0)).toEqual(pts("F"));
    expect(pts("+F", 10, 360)[0][3]).toBeCloseTo(-10);
  });
  it("negative theta reverses the turn direction", () => {
    expect(pts("+F", 10, -90)).toEqual(pts("-F", 10, 90));
  });
  it("negative length draws backwards", () => {
    expect(pts("F", -10)).toEqual([[0, 0, 0, 10]]);
  });
  it("handles a very long string of moves without error", () => {
    expect(trace("F".repeat(50000), 0.001)).toHaveLength(50000);
  }, 60000);
});

describe("forest start positions", () => {
  it("starts at the bottom edge; tree 0 stays at the centre", () => {
    const p = forestStart(1000, 600, 5, 0, scripted(0.9, 0.9));
    expect(p).toEqual(new Vector(500, 600));
  });
  it("spreads trees by floor(random * (0.8 * width / count)) * index to the left or right", () => {
    // divide = 1000*0.8/5 = 160; floor(0.5*160) = 80; * index 3 = 240
    expect(forestStart(1000, 600, 5, 3, scripted(0.5, 0.49))).toEqual(new Vector(740, 600));
    expect(forestStart(1000, 600, 5, 3, scripted(0.5, 0.5))).toEqual(new Vector(260, 600));
  });
  it("draws offset first, then side (order matters for seeded reproducibility)", () => {
    expect(forestStart(1000, 600, 5, 1, scripted(0.25, 0.1)).x).toBe(540);
  });
});
