import { describe, expect, it } from "vitest";
import { Rule, RuleSet, Successor } from "../src/javascripts/lsystem/model";
import { rewrite } from "../src/javascripts/lsystem/rewrite";
import { presets } from "../src/javascripts/lsystem/presets";
import { expand, scripted, seeded } from "./helpers";

const rs = (rules: Rule[], ignore: string[] = [""], start = "") => new RuleSet("t", start, 90, 4, rules, ignore);
const rule = (p: string, s: [string, number][], l = "*", r = "*") =>
  new Rule(p, s.map(([t, w]) => new Successor(t, w)), l, r);

describe("successor weight selection", () => {
  // Cumulative weights: A 0.25, B 0.75, C 1.0. The first successor whose cumulative weight >= pick wins.
  const stochastic = rs([rule("X", [["A", 0.25], ["B", 0.5], ["C", 0.25]])]);
  const pick = (r: number) => rewrite(stochastic, "X", scripted(r));

  it.each([
    [0, "A"], [0.2499, "A"], [0.25, "A"], // boundary is inclusive
    [0.2501, "B"], [0.75, "B"], [0.7501, "C"], [0.9999999, "C"],
  ])("pick %s selects %s", (r, expected) => {
    expect(pick(r)).toBe(expected);
  });

  it("consumes exactly one random value per rewritten symbol and none for unmatched symbols", () => {
    expect(rewrite(stochastic, "aXbX", scripted(0.1, 0.9))).toBe("aAbC");
  });

  it("leaves the symbol unchanged when the weights sum to less than the pick", () => {
    const low = rs([rule("X", [["A", 0.3], ["B", 0.3]])]);
    expect(rewrite(low, "X", scripted(0.7))).toBe("X");
  });

  it("is reproducible for a given seed and varies between seeds (Fractal Plant 8)", () => {
    const plant8 = presets.find(p => p.name === "Fractal Plant 8")!;
    const a = expand(plant8, 4, seeded(42)).current;
    expect(expand(plant8, 4, seeded(42)).current).toBe(a);
    const others = new Set([1, 2, 3, 4, 5].map(s => expand(plant8, 4, seeded(s)).current));
    expect(others.size).toBeGreaterThan(1);
  });

  it("Fractal Plant 8 picks each of its three successors at the 0.34/0.33/0.33 boundaries", () => {
    const plant8 = presets.find(p => p.name === "Fractal Plant 8")!;
    const out = (r: number) => rewrite(plant8, "F", scripted(r));
    expect(out(0.34)).toBe("F[+F]F[-F]F");
    expect(out(0.341)).toBe("F[+F]F");
    expect(out(0.67)).toBe("F[+F]F");
    expect(out(0.671)).toBe("F[-F]F");
    expect(out(0.999)).toBe("F[-F]F"); // 0.34+0.33+0.33 = 1.0 within float error
  });
});

describe("rule application", () => {
  it("appends every matching rule (rules are not exclusive)", () => {
    expect(rewrite(rs([rule("A", [["x", 1]]), rule("A", [["y", 1]])]), "A", seeded(1))).toBe("xy");
  });

  it("rewrites all symbols in parallel from the previous generation", () => {
    expect(rewrite(rs([rule("A", [["B", 1]]), rule("B", [["A", 1]])]), "AB", seeded(1))).toBe("BA");
  });

  it("returns an empty string for an empty string, without drawing randoms", () => {
    expect(rewrite(rs([rule("A", [["B", 1]])]), "", scripted())).toBe("");
  });

  it("does not match a blank predecessor", () => {
    expect(rewrite(rs([rule("", [["B", 1]])]), "AB", seeded(1))).toBe("AB");
  });

  it("allows a successor to be the empty string", () => {
    expect(rewrite(rs([rule("A", [["", 1]])]), "xAx", seeded(1))).toBe("xx");
  });
});

describe("context-sensitive rules", () => {
  // Contexts are only checked from index 2 on (existing `i > 1` guard, see known-defects tests).
  const ctx = (l: string, r: string, ignore: string[] = [""]) => rs([rule("A", [["!", 1]], l, r)], ignore);
  const run = (set: RuleSet, s: string) => rewrite(set, s, seeded(1));

  it("requires the left neighbour to match", () => {
    expect(run(ctx("L", "*"), "xxLA")).toBe("xxL!");
    expect(run(ctx("L", "*"), "xxMA")).toBe("xxMA");
  });

  it("requires the right neighbour to match", () => {
    expect(run(ctx("*", "R"), "xxAR")).toBe("xx!R");
    expect(run(ctx("*", "R"), "xxAM")).toBe("xxAM");
  });

  it("accepts a context mismatch when the neighbour is in the ignore list", () => {
    expect(run(ctx("L", "*", ["+"]), "xx+A")).toBe("xx+!");
    expect(run(ctx("L", "*", []), "xx+A")).toBe("xx+A");
  });

  it("'*' accepts any neighbour", () => {
    expect(run(ctx("*", "*"), "xxQAZ")).toBe("xxQ!Z");
  });

  it("skips a bracketed branch on the left (reads the symbol before the branch)", () => {
    expect(run(ctx("L", "*"), "xL[Q]A")).toBe("xL[Q]!");
    expect(run(ctx("L", "*"), "xM[Q]A")).toBe("xM[Q]A");
  });

  it("skips a bracketed branch on the right (reads the symbol after the branch)", () => {
    expect(run(ctx("*", "R"), "xxA[Q]R")).toBe("xx![Q]R");
    expect(run(ctx("*", "R"), "xxA[Q]M")).toBe("xxA[Q]M");
  });

  it("does not check the right context for a symbol at the end of the string", () => {
    expect(run(ctx("*", "R"), "xxA")).toBe("xx!");
  });

  it("Fractal Plant 9: pins the first three generations (characterisation of current behaviour)", () => {
    const plant9 = presets.find(p => p.name === "Fractal Plant 9")!;
    expect(expand(plant9, 3, seeded(1)).generations).toEqual([
      "F1F1F1",
      "F1100F1100F1100",
      "F100001[+F1F1]F100001[+F1F1]F100001[+F1F1]",
      "F100001[+F1F1]11[-F1100F1]F100001[+F1F1]11[-F1100F1]F100001[+F1F1]1[-F1100F1]",
    ]);
  });
});
