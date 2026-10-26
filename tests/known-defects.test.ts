// Known defects of the current algorithm (see docs/AUDIT.md and tests/README.md).
//
// Each defect has two parts:
//  * "current behaviour": a characterisation test that pins what the code does today, named so nobody mistakes it
//    for desired behaviour; and
//  * "desired behaviour": an `it.fails` test asserting what a fix should do. While the defect exists the assertion
//    fails and `it.fails` passes; once the defect is fixed the test starts failing, which is the cue to delete the
//    characterisation test and turn `it.fails` into `it`.
// None of these assertions is a statement that the current behaviour is correct.
import { describe, expect, it } from "vitest";
import { Rule, RuleSet, Successor, Transform, Vector } from "../src/javascripts/lsystem/model";
import { presets } from "../src/javascripts/lsystem/presets";
import { rewrite } from "../src/javascripts/lsystem/rewrite";
import { RotateTransform, traceLines } from "../src/javascripts/lsystem/turtle";
import { expand, seeded } from "./helpers";

const set = (rules: Rule[], ignore: string[] = [""]) => new RuleSet("t", "", 90, 4, rules, ignore);
const rule = (p: string, s: [string, number][], l = "*", r = "*") =>
  new Rule(p, s.map(([t, w]) => new Successor(t, w)), l, r);
const preset = (n: string) => presets.find(p => p.name === n)!;

describe("rule with no successors (AUDIT known defect 5)", () => {
  const empty = set([rule("A", [])]);
  it("current behaviour: throws TypeError", () => {
    expect(() => rewrite(empty, "A", seeded(1))).toThrow(TypeError);
  });
  it.fails("desired behaviour: leaves the symbol unchanged instead of throwing", () => {
    expect(rewrite(empty, "A", seeded(1))).toBe("A");
  });
});

describe("blank and non-numeric successor weights (AUDIT known defect 5)", () => {
  it("current behaviour: a weight-0 successor is skipped, so the symbol survives", () => {
    expect(rewrite(set([rule("A", [["", 0]])]), "A", () => 0.5)).toBe("A");
  });
  it("current behaviour: a NaN weight is never chosen", () => {
    expect(rewrite(set([rule("A", [["x", NaN]])]), "A", () => 0.5)).toBe("A");
  });
});

describe("empty-string contexts (Dragon Curve, Fractal Plant 7; AUDIT anomalies 2 and 3)", () => {
  it("current behaviour: '' contexts only pass where the context check is skipped (index <= 1 on the left, last index on the right)", () => {
    const r = set([rule("A", [["!", 1]], "", "")]);
    expect(rewrite(r, "A", seeded(1))).toBe("!");
    expect(rewrite(r, "AAAA", seeded(1))).toBe("AAAA");
  });
  it("current behaviour: Dragon Curve grows linearly (1, 2, 3, 4 segments)", () => {
    const counts = expand(preset("Dragon Curve"), 3, seeded(1)).generations
      .map(g => [...g].filter(c => c === "F").length);
    expect(counts).toEqual([1, 2, 3, 4]);
  });
  it.fails("desired behaviour: Dragon Curve doubles its segments each generation", () => {
    const counts = expand(preset("Dragon Curve"), 3, seeded(1)).generations
      .map(g => [...g].filter(c => c === "F").length);
    expect(counts).toEqual([1, 2, 4, 8]);
  });
  it("current behaviour: Fractal Plant 7 stalls (iteration 3 is 22 characters)", () => {
    expect(expand(preset("Fractal Plant 7"), 3).current).toHaveLength(22);
  });
});

describe("context check skips index 1 (`i > 1` guard; AUDIT known defect 7)", () => {
  const r = set([rule("A", [["!", 1]], "L", "*")]);
  it("current behaviour: a symbol at index 1 is rewritten whatever its left neighbour", () => {
    expect(rewrite(r, "xA", seeded(1))).toBe("x!");
  });
  it.fails("desired behaviour: a symbol at index 1 with a non-matching left neighbour is left alone", () => {
    expect(rewrite(r, "xA", seeded(1))).toBe("xA");
  });
});

describe("malformed contexts", () => {
  it("current behaviour: a multi-character context never matches (compared with one neighbour character)", () => {
    expect(rewrite(set([rule("A", [["!", 1]], "LL", "*")]), "LLLA", seeded(1))).toBe("LLLA");
  });
  it("current behaviour: an unmatched ']' to the left terminates without error and without a match", () => {
    expect(rewrite(set([rule("A", [["!", 1]], "L", "*")]), "xx]A", seeded(1))).toBe("xx]A");
  });
  it("current behaviour: an unmatched '[' to the right terminates without error and without a match", () => {
    expect(rewrite(set([rule("A", [["!", 1]], "*", "R")]), "xxA[x", seeded(1))).toBe("xxA[x");
  });
});

describe("heading is not wrapped at 360 (RotateTransform)", () => {
  it("current behaviour: 270 + 90 stays 360", () => {
    const t = new Transform(new Vector(0, 0), 270);
    RotateTransform(t, 90);
    expect(t.rot).toBe(360);
  });
  it.fails("desired behaviour: headings wrap into [0, 360)", () => {
    const t = new Transform(new Vector(0, 0), 270);
    RotateTransform(t, 90);
    expect(t.rot).toBeLessThan(360);
  });
});

describe("no limit on exponential expansion (AUDIT known defect 6)", () => {
  const boom = new RuleSet("boom", "F", 90, 4, [rule("F", [["F".repeat(20), 1]])], [""]);
  it("current behaviour: expands without bound (20^4 = 160 000 characters)", () => {
    expect(expand(boom, 4).current).toHaveLength(160000);
  });
  it.fails("desired behaviour: an expansion past a safety cap (here 100 000 characters) is refused", () => {
    expect(() => expand(boom, 4)).toThrow();
  });
});

describe("drawing nothing", () => {
  it("current behaviour: traceLines returns no segments for move-only or turn-only strings (Draw() then reads lines[0] and would crash in the app; not testable here)", () => {
    const b = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    expect(traceLines("f+-f", 1, 90, new Vector(0, 0), b)).toEqual([]);
  });
});

describe("UI truncates non-integer thetas (GetSystem uses parseInt; AUDIT anomaly 4)", () => {
  it("current behaviour: the app draws Fractal Plant 2 with 25 degrees, not the preset's 25.7", () => {
    expect(parseInt(String(preset("Fractal Plant 2").theta))).toBe(25);
    expect(preset("Fractal Plant 2").theta).not.toBe(25);
  });
});
