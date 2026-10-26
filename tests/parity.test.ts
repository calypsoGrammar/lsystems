// Parity of the CAL-1272 engine with the recorded reference (docs/baseline.json) and with the frozen legacy rewrite.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Vector } from "../src/javascripts/lsystem/model";
import { expandGrammar, MAX_GENERATION_SYMBOLS, MAX_TOTAL_SYMBOLS } from "../src/javascripts/lsystem/grammar";
import { presets } from "../src/javascripts/lsystem/presets";
import { rewrite } from "../src/javascripts/lsystem/rewrite";
import { traceLines } from "../src/javascripts/lsystem/turtle";
import { legacyRewrite } from "./legacyRewrite";
import { seeded } from "./helpers";

const baseline = JSON.parse(readFileSync(new URL("../docs/baseline.json", import.meta.url), "utf8"));

describe("docs/baseline.json (iterations 0-3, seed 1 for the stochastic preset)", () => {
  it.each(baseline.presets.map((e: any) => [e.name, e]))("%s", (name: string, e: any) => {
    const p = presets.find(x => x.name === name)!;
    const gens = expandGrammar(p, 3, seeded(1));
    for (const i of [0, 1, 2, 3]) {
      expect(gens[i].length, `${name} i${i} length`).toBe(e.iterations[i].length);
      if (e.iterations[i].string !== undefined) expect(gens[i], `${name} i${i}`).toBe(e.iterations[i].string);
    }
  });
});

describe("legacy rewrite parity up to iteration 5 (nesting-aware traversal)", () => {
  const run = (name: string, depth: number) => {
    const p = presets.find(x => x.name === name)!;
    const ra = seeded(1), rb = seeded(1);
    let a = p.start, b = p.start;
    const out: [string, string][] = [];
    for (let i = 1; i <= depth; i++) { a = rewrite(p, a, ra); b = legacyRewrite(p, b, rb); out.push([a, b]); }
    return out;
  };
  it.each(presets.filter(p => p.name !== "Lakes and Islands" && p.name !== "Fractal Plant 9").map(p => p.name))(
    "%s is identical to the legacy output", name => {
      for (const [a, b] of run(name, 4)) expect(a).toBe(b);
    });
  it("Fractal Plant 9 is identical to iteration 4 and differs at iteration 5 (documented: nested branches)", () => {
    const r = run("Fractal Plant 9", 5);
    for (let i = 0; i < 4; i++) expect(r[i][0]).toBe(r[i][1]);
    expect(r[4][0].length).toBe(251);
    expect(r[4][1].length).toBe(252);
  });
});

describe("largest accepted size stays drawable", () => {
  it("expands and traces Koch Island iteration 5 (243k symbols, 131k segments) within 10 s", () => {
    const p = presets.find(x => x.name === "Koch Island")!;
    const t = Date.now();
    const cur = expandGrammar(p, 5)[5];
    const lines = traceLines(cur, 1, p.theta, new Vector(0, 0), { minX: 0, maxX: 0, minY: 0, maxY: 0 });
    expect(lines).toHaveLength(131072);
    expect(Date.now() - t).toBeLessThan(10_000);
  });
  it("traces a maximal single-generation string of the cap size within 10 s", () => {
    const t = Date.now();
    const s = "F[+F]F[-F]".repeat(MAX_GENERATION_SYMBOLS / 10);
    const lines = traceLines(s, 1, 25, new Vector(0, 0), { minX: 0, maxX: 0, minY: 0, maxY: 0 });
    expect(lines.length).toBeGreaterThan(0);
    expect(Date.now() - t).toBeLessThan(10_000);
  });
  it("shares the total budget when given one (forest)", () => {
    const p = presets.find(x => x.name === "Koch Island")!;
    const first = expandGrammar(p, 5);
    const used = first.reduce((n, g) => n + g.length, 0);
    expect(used).toBeLessThan(MAX_TOTAL_SYMBOLS);
    expect(() => expandGrammar(p, 5, Math.random, MAX_TOTAL_SYMBOLS - used)).not.toThrow();
    expect(() => expandGrammar(p, 5, Math.random, used - 1)).toThrow();
  });
});
