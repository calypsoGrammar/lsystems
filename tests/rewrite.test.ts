import { describe, expect, it, vi } from "vitest";
import { Rewrite } from "../src/javascripts/lsystem";
import { rule, sequence, system, weighted } from "./helpers";

describe("rewrite: rule expansion", () =>
{
  it("replaces every matching predecessor and copies other characters", () =>
  {
    let rs = system("F+G", [rule("F", "FF")]);
    expect(Rewrite(rs, "F+G")).toBe("FF+G");
  });

  it("rewrites in parallel, not recursively", () =>
  {
    let rs = system("A", [rule("A", "AB"), rule("B", "A")]);
    expect(Rewrite(rs, "AB")).toBe("ABA");
  });

  it("returns the input for an empty rule list and an empty string for an empty axiom", () =>
  {
    expect(Rewrite(system("F", []), "F+F")).toBe("F+F");
    expect(Rewrite(system("", [rule("F", "FF")]), "")).toBe("");
  });

  it("draws once even for a single-successor rule", () =>
  {
    // weight 1 is >= any pick in [0,1), so the successor is always chosen
    let random = sequence(0.99);
    expect(Rewrite(system("F", [rule("F", "FF")]), "F", random)).toBe("FF");
  });

  it("appends the successor of every matching rule (rules are not exclusive)", () =>
  {
    let rs = system("F", [rule("F", "A"), rule("F", "B")]);
    expect(Rewrite(rs, "F")).toBe("AB");
  });

  it("never matches an empty predecessor", () =>
  {
    expect(Rewrite(system("F", [rule("", "X")]), "FF")).toBe("FF");
  });

  it("only matches single-character predecessors", () =>
  {
    expect(Rewrite(system("F", [rule("FF", "X")]), "FF")).toBe("FF");
  });

  it("uses Math.random when no source is injected", () =>
  {
    let spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try
    {
      let rs = system("F", [weighted("F", ["A", 0.4], ["B", 0.6])]);
      expect(Rewrite(rs, "F")).toBe("B");
      expect(spy).toHaveBeenCalledTimes(1);
    }
    finally
    {
      spy.mockRestore();
    }
  });
});

describe("rewrite: weight selection boundaries", () =>
{
  let rs = system("F", [weighted("F", ["A", 0.25], ["B", 0.5], ["C", 0.25])]);
  let pick = (value: number) => Rewrite(rs, "F", sequence(value));

  it("picks the first successor at 0 and up to its cumulative weight (inclusive)", () =>
  {
    expect(pick(0)).toBe("A");
    expect(pick(0.2499)).toBe("A");
    expect(pick(0.25)).toBe("A");
  });

  it("moves to the next successor just above a boundary", () =>
  {
    expect(pick(0.2501)).toBe("B");
    expect(pick(0.75)).toBe("B");
    expect(pick(0.7501)).toBe("C");
  });

  it("picks the last successor up to the top of the range", () =>
  {
    expect(pick(0.9999999)).toBe("C");
  });

  it("draws exactly once per rewritten character", () =>
  {
    expect(Rewrite(rs, "FF", sequence(0.1, 0.9))).toBe("AC");
    expect(() => Rewrite(rs, "FF", sequence(0.1))).toThrow("exhausted");
  });

  it("draws nothing for characters no rule matches", () =>
  {
    expect(Rewrite(rs, "+-[]", sequence())).toBe("+-[]");
  });

  it("keeps the character when the weights add up to less than the pick", () =>
  {
    let low = system("F", [weighted("F", ["A", 0.2], ["B", 0.2])]);
    expect(Rewrite(low, "F", sequence(0.5))).toBe("F");
    expect(Rewrite(low, "F", sequence(0.4))).toBe("B");
  });

  it("selects a zero-weight first successor only when the pick is exactly 0", () =>
  {
    let zero = system("F", [weighted("F", ["", 0], ["X", 1])]);
    expect(Rewrite(zero, "F", sequence(0))).toBe("");
    expect(Rewrite(zero, "F", sequence(0.0001))).toBe("X");
  });

  it("never selects a NaN weight", () =>
  {
    let nan = system("F", [weighted("F", ["A", NaN], ["B", 1])]);
    // NaN poisons the running total, so nothing matches and the character survives
    expect(Rewrite(nan, "F", sequence(0.5))).toBe("F");
  });

  it("selects the successors of Fractal Plant 8 at the 0.34/0.67/1.0 boundaries", () =>
  {
    let plant = system("F", [weighted("F", ["A", 0.34], ["B", 0.33], ["C", 0.33])]);
    expect(Rewrite(plant, "F", sequence(0.34))).toBe("A");
    expect(Rewrite(plant, "F", sequence(0.3401))).toBe("B");
    expect(Rewrite(plant, "F", sequence(0.6701))).toBe("C");
  });
});

describe("rewrite: context sensitivity", () =>
{
  // Position 0 and 1 are never context-checked (i > 1 guard), so test from index 2 on.
  it("applies a rule only when both neighbours match", () =>
  {
    let rs = system("", [rule("B", "X", "A", "C")]);
    expect(Rewrite(rs, "..ABC")).toBe("..AXC");
    expect(Rewrite(rs, "..ABD")).toBe("..ABD");
    expect(Rewrite(rs, "..DBC")).toBe("..DBC");
  });

  it("treats * as any neighbour", () =>
  {
    let rs = system("", [rule("B", "X", "*", "C"), rule("D", "Y", "A", "*")]);
    expect(Rewrite(rs, "..zBC..ADq")).toBe("..zXC..AYq");
  });

  it("skips ignored symbols as neighbours", () =>
  {
    let rs = system("", [rule("B", "X", "A", "C")], ["+", "-"]);
    // the neighbour is + (ignored), so the context is considered satisfied
    expect(Rewrite(rs, "..+B+")).toBe("..+X+");
    // a non-ignored wrong neighbour still blocks it
    expect(Rewrite(rs, "..DB+")).toBe("..DB+");
  });

  it("jumps over a bracketed branch on the left (reads the symbol before it)", () =>
  {
    let rs = system("", [rule("B", "X", "A", "*")]);
    expect(Rewrite(rs, "..A[+F]B")).toBe("..A[+F]X");
    expect(Rewrite(rs, "..D[+F]B")).toBe("..D[+F]B");
  });

  it("jumps over a bracketed branch on the right (reads the symbol after it)", () =>
  {
    let rs = system("", [rule("B", "X", "*", "C")]);
    expect(Rewrite(rs, "..B[+F]C")).toBe("..X[+F]C");
    expect(Rewrite(rs, "..B[+F]D")).toBe("..B[+F]D");
  });

  it("does not check the right context at the end of the string", () =>
  {
    let rs = system("", [rule("B", "X", "*", "C")]);
    expect(Rewrite(rs, "..B")).toBe("..X");
  });

  it("lets two context rules for the same predecessor pick by neighbours (Fractal Plant 9 style)", () =>
  {
    let rs = system("", [rule("0", "a", "1", "1"), rule("0", "b", "1", "0")], []);
    expect(Rewrite(rs, "..1011")).toBe("..1a11");
    expect(Rewrite(rs, "..1002")).toBe("..1b02");
    expect(Rewrite(rs, "..1112")).toBe("..1112");
    // at the end of the string the right context is skipped, so both rules fire
    expect(Rewrite(rs, "..10")).toBe("..1ab");
  });

  it("treats malformed (multi-character) contexts as never matching", () =>
  {
    let rs = system("", [rule("B", "X", "AB", "*")]);
    expect(Rewrite(rs, "..ABC")).toBe("..ABC");
  });

  it("terminates on unbalanced brackets next to a context rule", () =>
  {
    let rs = system("", [rule("B", "X", "A", "C")], ["+"]);
    expect(Rewrite(rs, "..A]B")).toBe("..A]B");
    expect(Rewrite(rs, "..B[C")).toBe("..B[C");
    expect(Rewrite(rs, "..]]]B[[[")).toBe("..]]]B[[[");
  });
});

describe("rewrite: invalid and edge inputs", () =>
{
  it("accepts a very long string without recursion errors", () =>
  {
    let rs = system("F", [rule("F", "F")]);
    let long = "F".repeat(200_000);
    expect(Rewrite(rs, long)).toHaveLength(200_000);
  });

  it("copes with an empty successor string (deletes the character)", () =>
  {
    expect(Rewrite(system("F", [rule("F", "")]), "F+F")).toBe("+");
  });
});
