// Grammar engine (CAL-1272): validation, limits, branch-aware context traversal. No DOM or Canvas is imported.
import { describe, expect, it } from "vitest";
import { Rule, RuleSet, Successor } from "../src/javascripts/lsystem/model";
import { presets } from "../src/javascripts/lsystem/presets";
import { ExpansionLimitError, GrammarError, MAX_ITERATIONS, expandGrammar, validateIterations, validateRuleSet }
  from "../src/javascripts/lsystem/grammar";
import { leftNeighbour, rewrite, rightNeighbour } from "../src/javascripts/lsystem/rewrite";
import { scripted, seeded } from "./helpers";

const rule = (p: string, s: [string, number][], l = "*", r = "*") =>
  new Rule(p, s.map(([t, w]) => new Successor(t, w)), l, r);
const set = (rules: Rule[], start = "", ignore: string[] = [""], factor = 4) =>
  new RuleSet("t", start, 90, factor, rules, ignore);

describe("presets", () => {
  it.each(presets.map(p => [p.name, p] as const))("%s is a valid grammar", (_n, p) => {
    expect(validateRuleSet(p)).toEqual([]);
  });
  it("every preset expands through expandGrammar to the default 2 iterations", () => {
    for (const p of presets) expect(expandGrammar(p, 2, seeded(1)), p.name).toHaveLength(3);
  });
});

describe("branch-aware context traversal", () => {
  it("skips a whole nested branch on the left", () => {
    expect(leftNeighbour("x[a[b]c]A", 8)).toBe("x");
    expect(leftNeighbour("x[a]A", 4)).toBe("x");
    expect(leftNeighbour("xA", 1)).toBe("x");
  });
  it("skips a whole nested branch on the right", () => {
    expect(rightNeighbour("A[a[b]c]y", 0)).toBe("y");
    expect(rightNeighbour("A[a]y", 0)).toBe("y");
  });
  it("gives '' beyond the string and returns the bracket itself when the branch is unbalanced", () => {
    expect(leftNeighbour("[a]A", 3)).toBe("");
    expect(rightNeighbour("A[a]", 0)).toBe("");
    expect(leftNeighbour("a]A", 2)).toBe("]");
    expect(rightNeighbour("A[a", 0)).toBe("[");
  });
  it("uses the symbol before a nested branch when matching a context", () => {
    const r = set([rule("A", [["!", 1]], "L", "R")]);
    expect(rewrite(r, "zzL[a[b]c]A[d[e]]R", seeded(1))).toBe("zzL[a[b]c]![d[e]]R");
    expect(rewrite(r, "zzQ[a[b]c]A[d[e]]R", seeded(1))).toBe("zzQ[a[b]c]A[d[e]]R");
  });
});

describe("rewrite edge cases", () => {
  it("draws one random value per matching rule and none otherwise", () => {
    const r = set([rule("A", [["x", 0.5], ["y", 0.5]])]);
    expect(rewrite(r, "BAB", scripted(0.9))).toBe("ByB");
  });
  it("throws ExpansionLimitError once the output would pass the cap", () => {
    const r = set([rule("A", [["AA", 1]])]);
    expect(() => rewrite(r, "AAAA", seeded(1), 7)).toThrow(ExpansionLimitError);
    expect(rewrite(r, "AAAA", seeded(1), 8)).toBe("AAAAAAAA");
  });
});

describe("validateRuleSet", () => {
  it("accepts weights summing to 1 within float error and below 1", () => {
    expect(validateRuleSet(set([rule("A", [["a", 0.34], ["b", 0.33], ["c", 0.33]])]))).toEqual([]);
    expect(validateRuleSet(set([rule("A", [["a", 0.2]])]))).toEqual([]);
    expect(validateRuleSet(set([rule("A", [])]))).toEqual([]);
  });
  it.each([
    ["empty predecessor", rule("", [["a", 1]])],
    ["multi-character predecessor", rule("AB", [["a", 1]])],
    ["multi-character left context", rule("A", [["a", 1]], "LL")],
    ["multi-character right context", rule("A", [["a", 1]], "*", "RR")],
    ["NaN weight", rule("A", [["a", NaN]])],
    ["negative weight", rule("A", [["a", -0.1], ["b", 1]])],
    ["total above 1", rule("A", [["a", 0.7], ["b", 0.7]])],
  ])("rejects %s", (_n, r) => {
    expect(validateRuleSet(set([r])).length).toBeGreaterThan(0);
  });
  it("rejects a bad factor or angle", () => {
    expect(validateRuleSet(set([], "", [""], 0))).not.toEqual([]);
    expect(validateRuleSet(new RuleSet("t", "", NaN, 4, [], [""]))).not.toEqual([]);
  });
  it("validates iterations", () => {
    expect(validateIterations(0)).toEqual([]);
    expect(validateIterations(MAX_ITERATIONS)).toEqual([]);
    for (const bad of [-1, 1.5, NaN, MAX_ITERATIONS + 1]) expect(validateIterations(bad)).not.toEqual([]);
  });
});

describe("expandGrammar", () => {
  it("returns every generation, axiom first", () => {
    expect(expandGrammar(set([rule("A", [["AB", 1]])], "A"), 2)).toEqual(["A", "AB", "ABB"]);
  });
  it("throws GrammarError for invalid grammars or iterations, and never a partial result", () => {
    expect(() => expandGrammar(set([rule("AB", [["a", 1]])], "A"), 1)).toThrow(GrammarError);
    expect(() => expandGrammar(set([], "A"), NaN)).toThrow(GrammarError);
    expect(() => expandGrammar(set([], "A"), MAX_ITERATIONS + 1)).toThrow(GrammarError);
  });
  it("refuses exponential growth with ExpansionLimitError quickly", () => {
    const boom = set([rule("F", [["F".repeat(20), 1]])], "F");
    expect(() => expandGrammar(boom, 10)).toThrow(ExpansionLimitError);
  });
  it("refuses an axiom over the limit and growth past the all-generations cap", () => {
    expect(() => expandGrammar(set([], "F".repeat(500_001)), 1)).toThrow(ExpansionLimitError);
    const steady = set([rule("F", [["F", 1]])], "F".repeat(400_000));
    expect(() => expandGrammar(steady, 6)).toThrow(ExpansionLimitError);
  });
  it("is reproducible with a seeded source and handles a zero-successor rule", () => {
    const r = set([rule("A", [["x", 0.5], ["y", 0.5]]), rule("B", [])], "AB");
    expect(expandGrammar(r, 2, seeded(3))).toEqual(expandGrammar(r, 2, seeded(3)));
    expect(expandGrammar(r, 1, seeded(3))[1].endsWith("B")).toBe(true);
  });
});
