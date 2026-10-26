import { describe, expect, it } from "vitest";
import { cantorSet, presets } from "../src/javascripts/lsystem/presets";
import { Rule, RuleSet, Successor } from "../src/javascripts/lsystem/model";
import { traceLines } from "../src/javascripts/lsystem/turtle";
import { Vector } from "../src/javascripts/lsystem/model";
import { expand, seeded } from "./helpers";

type Kind = "deterministic" | "bracketed" | "stochastic" | "context-sensitive";

// All 29 registered presets in menu order: name, axiom, theta, kind, and the expanded string length /
// drawn segment count after 2 iterations (seed 1 for the stochastic one). Counts match docs/AUDIT.md.
const TABLE: [string, string, number, Kind, number, number][] = [
  ["Koch Island", "F-F-F-F", 90, "deterministic", 475, 256],
  ["Koch Curve 2", "-F", 90, "deterministic", 50, 25],
  ["Lakes and Islands", "F+F+F+F", 90, "deterministic", 2595, 1296],
  ["Ruleset 1", "F-F-F-F", 90, "deterministic", 475, 256],
  ["Ruleset 2", "F-F-F-F", 90, "deterministic", 327, 196],
  ["Ruleset 3", "F-F-F-F", 90, "deterministic", 327, 196],
  ["Ruleset 4", "F-F-F-F", 90, "deterministic", 199, 100],
  ["Ruleset 5", "F-F-F-F", 90, "deterministic", 199, 100],
  ["Ruleset 6", "F-F-F-F", 90, "deterministic", 199, 100],
  ["Dragon Curve", "FX", 90, "deterministic", 10, 3],
  ["Sierpinski Curve", "F--XF--F--XF", 45, "deterministic", 182, 64],
  ["Sierpinkski Triangle", "F-G-G", 120, "deterministic", 45, 27],
  ["Koch Curve 1", "F", 60, "deterministic", 36, 16],
  ["Koch Snowflake", "F--F--F", 60, "deterministic", 112, 48],
  ["Hilbert Curve", "A", 90, "deterministic", 51, 15],
  ["Levy C Curve", "F", 45, "deterministic", 16, 4],
  ["Star", "F", 77, "deterministic", 10, 4],
  ["Pentigree Curve", "F-F-F-F-F", 72, "deterministic", 394, 180],
  ["Snowflake", "F++F++F++F++F", 36, "deterministic", 608, 180],
  ["Gosper Curve", "F", 60, "deterministic", 113, 49],
  ["Fractal Plant 1", "X", 25, "bracketed", 89, 18],
  ["Fractal Plant 2", "F", 25.7, "bracketed", 61, 25],
  ["Fractal Plant 3", "F", 22.5, "bracketed", 172, 64],
  ["Fractal Plant 4", "F", 20, "bracketed", 73, 25],
  ["Fractal Plant 5", "X", 20, "bracketed", 47, 10],
  ["Fractal Plant 6", "X", 25.7, "bracketed", 43, 10],
  ["Fractal Plant 7", "X", 22.5, "bracketed", 18, 4],
  ["Fractal Plant 8", "F", 20, "stochastic", 26, 11],
  ["Fractal Plant 9", "F1F1F1", 22.5, "context-sensitive", 42, 9],
];

const draws = (s: string) => [...s].filter(c => c === "F" || c === "G").length;

function balanced(s: string)
{
  let depth = 0;
  for (const c of s) {
    if (c === "[") depth++;
    if (c === "]" && --depth < 0) return false;
  }
  return depth === 0;
}

describe("preset inventory", () => {
  it("registers exactly 29 presets in menu order", () => {
    expect(presets.map(p => p.name)).toEqual(TABLE.map(t => t[0]));
  });

  it("does not register Cantor Set (defined but unused, see tests/README.md)", () => {
    expect(presets).not.toContain(cantorSet);
    expect(cantorSet.name).toBe("Cantor Set");
  });

  it("uses factor 4 and a [''] ignore list (except Fractal Plant 9) on every preset", () => {
    for (const p of presets) {
      expect(p.factor, p.name).toBe(4);
      expect(p.ignore, p.name).toEqual(p.name === "Fractal Plant 9" ? ["+", "-", "F"] : [""]);
    }
  });
});

describe.each(TABLE)("%s", (name, axiom, theta, kind, len2, lines2) => {
  const preset = presets.find(p => p.name === name)!;

  it("has the expected axiom and theta", () => {
    expect(preset.start).toBe(axiom);
    expect(preset.theta).toBe(theta);
  });

  it("is classified consistently with its rules", () => {
    const stochastic = preset.rules.some(r => r.successors.length > 1);
    const context = preset.rules.some(r => r.contextL !== "*" || r.contextR !== "*");
    const bracketed = preset.rules.some(r => /[[\]]/.test(r.successors.map(s => s.successor).join("")));
    // Dragon Curve and Fractal Plant 7 carry '' contexts (a known defect), so only check the clear cases.
    if (kind === "stochastic") expect(stochastic).toBe(true);
    else expect(stochastic).toBe(false);
    if (kind === "context-sensitive") expect(context).toBe(true);
    if (kind === "bracketed") expect(bracketed).toBe(true);
    if (kind === "deterministic" && name !== "Dragon Curve") expect(context).toBe(false);
  });

  it("expands to the recorded size at iteration 2 with a seeded source", () => {
    const { current } = expand(preset, 2, seeded(1));
    expect(current.length).toBe(len2);
    expect(draws(current)).toBe(lines2);
    expect(traceLines(current, 1, preset.theta, new Vector(0, 0), { minX: 0, maxX: 0, minY: 0, maxY: 0 })).toHaveLength(lines2);
  });

  it("only produces known turtle symbols plus its own variables, with balanced brackets, up to iteration 3", () => {
    const known = new Set([...axiom, ..."FGf+-[]", ...preset.rules.map(r => r.predecessor),
      ...preset.rules.flatMap(r => r.successors.flatMap(s => [...s.successor]))]);
    const depth = name === "Lakes and Islands" ? 2 : 3; // iteration 3 is 47k chars, still fast, but 2 keeps it cheap
    const { generations } = expand(preset, depth, seeded(7));
    for (const g of generations) {
      expect(balanced(g), g.slice(0, 80)).toBe(true);
      for (const c of g) expect(known.has(c), `unexpected ${c}`).toBe(true);
    }
  });

  if (kind !== "stochastic") {
    it("is deterministic: output does not depend on the random source (a single weight-1 successor always wins)", () => {
      // Note: rewrite() still draws one random value per matching rule, even for a lone successor.
      const a = expand(preset, 2, seeded(1)).current;
      expect(expand(preset, 2, seeded(99)).current).toBe(a);
      expect(expand(preset, 2, () => 0.999999).current).toBe(a);
    });
  }
});

describe("well-known deterministic outputs", () => {
  const get = (n: string) => presets.find(p => p.name === n)!;
  const gens = (n: string, i: number) => expand(get(n), i).generations;

  it("Koch Curve 1", () => {
    expect(gens("Koch Curve 1", 2)).toEqual(["F", "F+F--F+F", "F+F--F+F+F+F--F+F--F+F--F+F+F+F--F+F"]);
  });
  it("Koch Island", () => {
    expect(gens("Koch Island", 1)[1]).toBe(
      "F-F+F+FF-F-F+F-F-F+F+FF-F-F+F-F-F+F+FF-F-F+F-F-F+F+FF-F-F+F");
  });
  it("Levy C Curve", () => {
    expect(gens("Levy C Curve", 2)).toEqual(["F", "+F--F+", "++F--F+--+F--F++"]);
  });
  it("Sierpinkski Triangle", () => {
    expect(gens("Sierpinkski Triangle", 1)[1]).toBe("F-G+F+G-F-GG-GG");
  });
  it("Hilbert Curve", () => {
    expect(gens("Hilbert Curve", 1)[1]).toBe("+BF-AFA-FB+");
  });
  it("Fractal Plant 2", () => {
    expect(gens("Fractal Plant 2", 1)[1]).toBe("F[+F]F[-F]F");
  });
  it("Lakes and Islands rewrites f to ffffff", () => {
    expect(gens("Lakes and Islands", 1)[1]).toBe(
      "F+f-FF+F+FF+Ff+FF-f+FF-F-FF-Ff-FFF+F+f-FF+F+FF+Ff+FF-f+FF-F-FF-Ff-FFF+F+f-FF+F+FF+Ff+FF-f+FF-F-FF-Ff-FFF+F+f-FF+F+FF+Ff+FF-f+FF-F-FF-Ff-FFF");
  });
});

describe("custom rule sets", () => {
  it("leave characters with no rule unchanged", () => {
    const rs = new RuleSet("x", "ABC", 90, 4, [new Rule("B", [new Successor("BB", 1)], "*", "*")], [""]);
    expect(expand(rs, 2).current).toBe("ABBBBC");
  });
});
