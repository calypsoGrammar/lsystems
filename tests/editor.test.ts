// Editable ruleset state (CAL-1274): independent of the DOM, Canvas and presets.
import { describe, expect, it } from "vitest";
import { presets } from "../src/javascripts/lsystem/presets";
import { expandGrammar } from "../src/javascripts/lsystem/grammar";
import {
  addRule, addSuccessor, buildRuleSet, fieldIds, removeRule, removeSuccessor, stateFromPreset, statesEqual,
  validateState, type EditorState,
} from "../src/javascripts/lsystem/editor";
import { seeded } from "./helpers";

const base = (): EditorState => stateFromPreset(presets.find(p => p.name === "Koch Island")!);

describe("stateFromPreset / buildRuleSet", () => {
  it.each(presets.map(p => [p.name, p] as const))("%s round-trips to an identical expansion", (_n, p) => {
    const built = buildRuleSet(stateFromPreset(p));
    expect(built.ok).toBe(true);
    if (built.ok) expect(expandGrammar(built.ruleSet, 2, seeded(3))).toEqual(expandGrammar(p, 2, seeded(3)));
  });
  it("does not alias the preset", () => {
    const st = stateFromPreset(presets[0]);
    st.rules[0].successors[0].successor = "changed";
    expect(presets[0].rules[0].successors[0].successor).not.toBe("changed");
  });
});

describe("structural edits keep unrelated edits", () => {
  const edited = (): EditorState => {
    const s = base();
    s.axiom = "F+F"; s.theta = "45"; s.ignore = "+,-";
    s.rules[0].predecessor = "G";
    s.rules[0].successors[0].successor = "typed <b>&\"'";
    return s;
  };
  it("adding a rule", () => {
    const s = edited(), n = addRule(s);
    expect(n.rules).toHaveLength(2);
    expect({ ...n, rules: [n.rules[0]] }).toEqual({ ...s, rules: [s.rules[0]] });
  });
  it("adding / removing a successor", () => {
    const s = edited(), a = addSuccessor(s, 0);
    expect(a.rules[0].successors).toHaveLength(2);
    expect(a.rules[0].successors[0]).toEqual(s.rules[0].successors[0]);
    expect(a.axiom).toBe("F+F");
    expect(statesEqual(removeSuccessor(a, 0, 1), s)).toBe(true);
  });
  it("removing a rule", () => {
    const n = removeRule(addRule(edited()), 1);
    expect(statesEqual(n, edited())).toBe(true);
  });
  it("does not mutate its input", () => {
    const s = edited(), copy = JSON.stringify(s);
    addRule(s); addSuccessor(s, 0); removeSuccessor(s, 0, 0); removeRule(s, 0);
    expect(JSON.stringify(s)).toBe(copy);
  });
  it("a new successor takes the remaining probability", () => {
    const s = base(); s.rules[0].successors[0].weight = "0.25";
    expect(addSuccessor(s, 0).rules[0].successors[1].weight).toBe("0.75");
    expect(addSuccessor(base(), 0).rules[0].successors[1].weight).toBe("0");
  });
  it("a new rule is valid once it has a predecessor", () => {
    const s = addRule(base());
    expect(validateState(s).has(fieldIds.predecessor(1))).toBe(true);
    s.rules[1].predecessor = "X";
    expect(validateState(s).size).toBe(0);
  });
});

describe("validation", () => {
  const errs = (f: (s: EditorState) => void) => { const s = base(); f(s); return validateState(s); };
  it("accepts the unmodified preset", () => expect(validateState(base()).size).toBe(0));
  it("flags each bad field at its own id", () => {
    expect(errs(s => { s.axiom = ""; }).has(fieldIds.axiom)).toBe(true);
    expect(errs(s => { s.theta = "361"; }).has(fieldIds.theta)).toBe(true);
    expect(errs(s => { s.theta = ""; }).has(fieldIds.theta)).toBe(true);
    expect(errs(s => { s.iterations = "2.5"; }).has(fieldIds.iterations)).toBe(true);
    expect(errs(s => { s.iterations = "26"; }).has(fieldIds.iterations)).toBe(true);
    expect(errs(s => { s.factor = "0"; }).has(fieldIds.factor)).toBe(true);
    expect(errs(s => { s.rules[0].predecessor = ""; }).has(fieldIds.predecessor(0))).toBe(true);
    expect(errs(s => { s.rules[0].predecessor = "FF"; }).has(fieldIds.predecessor(0))).toBe(true);
    expect(errs(s => { s.rules[0].contextL = "**"; }).has(fieldIds.contextL(0))).toBe(true);
    expect(errs(s => { s.rules[0].contextR = "ab"; }).has(fieldIds.contextR(0))).toBe(true);
    expect(errs(s => { s.rules[0].successors = []; }).has(fieldIds.rule(0))).toBe(true);
  });
  it("flags blank, negative, non-numeric and over-unity weights", () => {
    for (const w of ["", "abc", "-1", "NaN"]) expect(errs(s => { s.rules[0].successors[0].weight = w; }).has(fieldIds.weight(0, 0)), w).toBe(true);
    const over = errs(s => { s.rules[0].successors.push({ successor: "F", weight: "0.5" }); });
    expect(over.has(fieldIds.weight(0, 0)) && over.has(fieldIds.weight(0, 1))).toBe(true);
  });
  it("an empty successor (deleting the symbol) is allowed", () => {
    expect(errs(s => { s.rules[0].successors[0].successor = ""; }).size).toBe(0);
  });
  it("buildRuleSet refuses invalid input and never alters the text", () => {
    const s = base(); s.rules[0].successors[0].weight = "1.5"; s.axiom = "  F ";
    const b = buildRuleSet(s);
    expect(b.ok).toBe(false);
    expect(s.axiom).toBe("  F ");
  });
  it("uses exactly the typed values", () => {
    const s = base(); s.axiom = "F-F"; s.theta = "22.5"; s.ignore = "+, -";
    s.rules[0].successors = [{ successor: "FF", weight: "0.3" }, { successor: "F", weight: "0.7" }];
    const b = buildRuleSet(s);
    expect(b.ok).toBe(true);
    if (b.ok) {
      expect(b.ruleSet.start).toBe("F-F");
      expect(b.ruleSet.theta).toBe(22.5);
      expect(b.ruleSet.ignore).toEqual(["+", " -"]);
      expect(b.ruleSet.rules[0].successors.map(x => [x.successor, x.weight])).toEqual([["FF", 0.3], ["F", 0.7]]);
    }
  });
});
