import { describe, expect, it } from "vitest";
import { lSystems, unregisteredPresets } from "../src/javascripts/presets";
import { Rewrite, RuleSet } from "../src/javascripts/lsystem";
import { seeded } from "./helpers";

// All 29 presets, in menu order. Renaming, reordering or dropping one must be deliberate.
const NAMES = [
  "Koch Island", "Koch Curve 2", "Lakes and Islands", "Ruleset 1", "Ruleset 2", "Ruleset 3",
  "Ruleset 4", "Ruleset 5", "Ruleset 6", "Dragon Curve", "Sierpinski Curve", "Sierpinkski Triangle",
  "Koch Curve 1", "Koch Snowflake", "Hilbert Curve", "Levy C Curve", "Star", "Pentigree Curve",
  "Snowflake", "Gosper Curve", "Fractal Plant 1", "Fractal Plant 2", "Fractal Plant 3",
  "Fractal Plant 4", "Fractal Plant 5", "Fractal Plant 6", "Fractal Plant 7", "Fractal Plant 8",
  "Fractal Plant 9",
];

function isStochastic(rs: RuleSet): boolean
{
  return rs.rules.some(r => r.successors.length > 1);
}

describe("preset catalogue", () =>
{
  it("registers exactly the 29 presets, in menu order", () =>
  {
    expect(lSystems.map(p => p.name)).toEqual(NAMES);
    expect(new Set(NAMES).size).toBe(29);
  });

  it("keeps Cantor Set defined but unregistered (documented anomaly)", () =>
  {
    expect(unregisteredPresets.map(p => p.name)).toEqual(["Cantor Set"]);
  });

  it("matches the committed preset definitions", () =>
  {
    // rules, contexts, weights, theta, factor, ignore list: any edit shows up as a snapshot diff
    expect(lSystems).toMatchSnapshot();
  });

  it.each(NAMES.map((n, i) => [n, i] as const))("%s is well formed", (_name, i) =>
  {
    let rs = lSystems[i];
    expect(rs.start.length).toBeGreaterThan(0);
    expect(rs.theta).toBeGreaterThan(0);
    expect(rs.factor).toBe(4);
    expect(rs.rules.length).toBeGreaterThan(0);
    for(let r of rs.rules)
    {
      expect(r.predecessor).toHaveLength(1);
      expect(r.successors.length).toBeGreaterThan(0);
    }
  });

  it("has weights that add up to 1 for the only stochastic preset", () =>
  {
    let stochastic = lSystems.filter(isStochastic);
    expect(stochastic.map(p => p.name)).toEqual(["Fractal Plant 8"]);
    let total = stochastic[0].rules[0].successors.reduce((a, s) => a + s.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("preset expansion at safe depths", () =>
{
  // Depth 3 keeps every preset under ~50k characters (Lakes and Islands is the largest).
  const DEPTH = 3;

  function expand(rs: RuleSet, depth: number, seed: number = 1): string[]
  {
    let random = seeded(seed);
    let out = [rs.start];
    for(let i = 0; i < depth; i++) out.push(Rewrite(rs, out[i], random));
    return out;
  }

  // Strings up to 400 characters are kept whole, longer ones as length + head + tail.
  function digest(s: string)
  {
    return s.length <= 400 ? s : { length: s.length, head: s.slice(0, 40), tail: s.slice(-40) };
  }

  it.each(NAMES.map((n, i) => [n, i] as const))("%s expands deterministically", (_name, i) =>
  {
    let rs = lSystems[i];
    let a = expand(rs, DEPTH);
    let b = expand(rs, DEPTH);
    expect(a).toEqual(b);
    expect(a[0]).toBe(rs.start);
    expect(a.map(digest)).toMatchSnapshot();
  });

  it("keeps stochastic output reproducible per seed and different across seeds", () =>
  {
    let plant8 = lSystems[27];
    expect(expand(plant8, 3, 7)).toEqual(expand(plant8, 3, 7));
    let outputs = new Set([1, 2, 3, 4, 5].map(seed => expand(plant8, 3, seed)[3]));
    expect(outputs.size).toBeGreaterThan(1);
  });

  it("expands stochastic output only with the three declared successors", () =>
  {
    let plant8 = lSystems[27];
    for(let seed = 1; seed <= 20; seed++)
    {
      let once = Rewrite(plant8, "F", seeded(seed));
      expect(["F[+F]F[-F]F", "F[+F]F", "F[-F]F"]).toContain(once);
    }
  });

  it.each([
    ["Koch Curve 1", 1, "F+F--F+F"],
    ["Koch Curve 1", 2, "F+F--F+F+F+F--F+F--F+F--F+F+F+F--F+F"],
    ["Levy C Curve", 1, "+F--F+"],
    ["Levy C Curve", 2, "++F--F+--+F--F++"],
    ["Star", 2, "F++F++F++F"],
    ["Sierpinkski Triangle", 1, "F-G+F+G-F-GG-GG"],
    ["Hilbert Curve", 1, "+BF-AFA-FB+"],
    ["Fractal Plant 2", 1, "F[+F]F[-F]F"],
  ])("%s, iteration %i, gives the well-known string", (name, depth, expected) =>
  {
    let rs = lSystems.find(p => p.name === name)!;
    expect(expand(rs, depth)[depth]).toBe(expected);
  });

  it("matches the known segment-count growth", () =>
  {
    // F count at depth 0..3, from docs/baseline.json
    let counts = (name: string) => expand(lSystems.find(p => p.name === name)!, 3).map(s => (s.match(/[FG]/g) ?? []).length);
    expect(counts("Koch Island")).toEqual([4, 32, 256, 2048]);
    expect(counts("Koch Curve 1")).toEqual([1, 4, 16, 64]);
    expect(counts("Hilbert Curve")).toEqual([0, 3, 15, 63]);
  });
});
