import { describe, expect, it } from "vitest";
import { Bounds, CentreOffset, Rewrite, RotateTransform, StartPosition, Transform, Vector } from "../src/javascripts/lsystem";
import { lSystems } from "../src/javascripts/presets";
import { Rule, RuleSet } from "../src/javascripts/lsystem";
import { rule, seeded, system } from "./helpers";

// Known existing defects (docs/AUDIT.md), kept apart from the regression tests.
//
// Each `it.fails` states the CORRECT behaviour. It passes today because the assertion
// fails; once the remediation lands the test starts failing, which tells whoever fixes
// the defect to delete `.fails` and move the test next to its siblings. None of these
// are expected behaviour: the passing tests elsewhere do not rely on them.
describe("known defects (expected to fail until remediated)", () =>
{
  const preset = (name: string) => lSystems.find(p => p.name === name)!;
  const expand = (rs: RuleSet, depth: number) =>
  {
    let random = seeded(1);
    let s = rs.start;
    for(let i = 0; i < depth; i++) s = Rewrite(rs, s, random);
    return s;
  };

  it.fails("Dragon Curve rewrites Y (its Y rule has '' contexts, so it never fires)", () =>
  {
    // a real dragon curve doubles each iteration: 1, 2, 4, 8 segments
    let segments = (s: string) => (s.match(/F/g) ?? []).length;
    expect(segments(expand(preset("Dragon Curve"), 3))).toBe(8);
  });

  it.fails("Fractal Plant 7 keeps growing (its X rule has '' contexts, so it stalls)", () =>
  {
    expect(expand(preset("Fractal Plant 7"), 3).length).toBeGreaterThan(100);
  });

  it.fails("applies the context check at index 1 (the guard is i > 1, not i > 0)", () =>
  {
    let rs = system("", [rule("B", "X", "A", "*")]);
    expect(Rewrite(rs, "DB")).toBe("DB"); // D is not the required left context A
  });

  it.fails("keeps the character when a rule has zero successors instead of throwing", () =>
  {
    let rs = system("F", [new Rule("F", [], "*", "*")]);
    expect(Rewrite(rs, "F")).toBe("F"); // today: TypeError reading successors[0]
  });

  it.fails("refuses an expansion beyond a sane output limit", () =>
  {
    // 5 000 chars x 1 000 each = 5 000 000 chars; there is no cap, so this succeeds
    let rs = system("F", [rule("F", "F".repeat(1000))]);
    expect(() => Rewrite(rs, "F".repeat(5000))).toThrow();
  });

  it.fails("wraps headings at 360 degrees (a heading of exactly 360 is left as is)", () =>
  {
    let t = new Transform(new Vector(0, 0), 270);
    RotateTransform(t, 90);
    expect(t.rot).toBeLessThan(360);
  });

  it.fails("copes with a system that draws nothing instead of throwing when centring", () =>
  {
    let bounds: Bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    expect(() => CentreOffset(bounds, undefined as never)).not.toThrow();
  });

  it.fails("places forest trees at finite positions when the count is 0", () =>
  {
    let p = StartPosition(1000, 600, true, 0, 1, seeded(1));
    expect(Number.isFinite(p.x)).toBe(true);
  });

  // Not coverable here because they live in main.ts and need a browser (see
  // scripts/browser-check.mjs and docs/AUDIT.md "Known defects").
  it.todo("UI truncates non-integer theta (25.7 draws as 25) via parseInt");
  it.todo("UI ignores each preset's factor and always uses 4");
  it.todo("canvas Scale setting has no visible effect");
  it.todo("resize regenerates the whole system, re-randomising stochastic output");
  it.todo("Add/Remove Successor and Remove Rule buttons throw ReferenceError in the built app");
  it.todo("O(n^2) branch-start scan makes iteration 4+ of large presets hang the tab");
});
