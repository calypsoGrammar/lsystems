// Editable ruleset state (CAL-1274). Holds exactly what the user has typed (as strings, so in-progress or invalid text is
// never coerced or dropped) and converts it to an engine RuleSet only after validation. No DOM, no Canvas, no presets
// dependency beyond the RuleSet type: the grammar engine (grammar.ts / rewrite.ts) knows nothing about this module.
import { Rule, RuleSet, Successor } from "./model";
import { MAX_ITERATIONS, validateRuleSet } from "./grammar";

export interface EditableSuccessor { successor: string; weight: string; }
export interface EditableRule
{
  predecessor: string;
  contextL: string;
  contextR: string;
  successors: EditableSuccessor[];
}
export interface EditorState
{
  axiom: string;
  theta: string;
  iterations: string;
  factor: string;
  rules: EditableRule[];
  ignore: string; // comma separated, as typed
}

// Path of the field an error belongs to; the same strings are used as DOM ids by the UI binding.
export type FieldId = string;
export const fieldIds = {
  axiom: "fSettingsAxiom",
  theta: "fSettingsTheta",
  iterations: "fSettingsIterations",
  factor: "fSettingsFactor",
  ignore: "ignore",
  predecessor: (r: number) => `predecessor${r}`,
  contextL: (r: number) => `contextLeft${r}`,
  contextR: (r: number) => `contextRight${r}`,
  successor: (r: number, s: number) => `successor${r}${s}`,
  weight: (r: number, s: number) => `weight${r}${s}`,
  rule: (r: number) => `replacementRule${r}`,
};

export const DEFAULT_ITERATIONS = "2";

export function stateFromPreset(preset: RuleSet): EditorState
{
  return {
    axiom: preset.start,
    theta: String(preset.theta),
    iterations: DEFAULT_ITERATIONS,
    factor: String(preset.factor),
    rules: preset.rules.map(r => ({
      predecessor: r.predecessor,
      contextL: r.contextL ?? "*",
      contextR: r.contextR ?? "*",
      successors: r.successors.map(s => ({ successor: s.successor, weight: String(s.weight) })),
    })),
    ignore: (preset.ignore ?? []).toString(),
  };
}

export function cloneState(s: EditorState): EditorState
{
  return {
    ...s,
    rules: s.rules.map(r => ({ ...r, successors: r.successors.map(x => ({ ...x })) })),
  };
}

export function statesEqual(a: EditorState, b: EditorState): boolean
{
  return JSON.stringify(a) === JSON.stringify(b);
}

// Weight suggested for a new successor: whatever probability the existing ones leave (a valid number, never > 1).
function remainingWeight(r: EditableRule): string
{
  const used = r.successors.reduce((n, s) => n + (Number.isFinite(Number(s.weight)) && s.weight.trim() !== "" ? Number(s.weight) : 0), 0);
  const left = Math.round(Math.max(0, 1 - used) * 1e9) / 1e9;
  return String(left);
}

// All of the mutators below return a new state and leave every other field exactly as it was.
export function addSuccessor(s: EditorState, rule: number): EditorState
{
  const n = cloneState(s);
  const r = n.rules[rule];
  if (r) r.successors.push({ successor: "", weight: remainingWeight(r) });
  return n;
}

export function removeSuccessor(s: EditorState, rule: number, successor: number): EditorState
{
  const n = cloneState(s);
  n.rules[rule]?.successors.splice(successor, 1);
  return n;
}

export function addRule(s: EditorState): EditorState
{
  const n = cloneState(s);
  n.rules.push({ predecessor: "", contextL: "*", contextR: "*", successors: [{ successor: "", weight: "1" }] });
  return n;
}

export function removeRule(s: EditorState, rule: number): EditorState
{
  const n = cloneState(s);
  n.rules.splice(rule, 1);
  return n;
}

export type FieldErrors = Map<FieldId, string>;

function num(text: string): number
{
  return text.trim() === "" ? NaN : Number(text);
}

// Field-level problems, in document order. Values are never modified.
export function validateState(s: EditorState): FieldErrors
{
  const e: FieldErrors = new Map();
  if (s.axiom.length === 0) e.set(fieldIds.axiom, "Enter an axiom (the starting string).");
  const theta = num(s.theta);
  if (!Number.isFinite(theta) || theta < 0 || theta > 360) e.set(fieldIds.theta, "Theta must be a number from 0 to 360.");
  const it = num(s.iterations);
  if (!Number.isInteger(it) || it < 0 || it > MAX_ITERATIONS) e.set(fieldIds.iterations, `Iterations must be a whole number from 0 to ${MAX_ITERATIONS}.`);
  const factor = num(s.factor);
  if (!(Number.isFinite(factor) && factor > 0)) e.set(fieldIds.factor, "Length reduction factor must be a number above 0.");

  s.rules.forEach((rule, i) =>
  {
    if (rule.predecessor.length !== 1) e.set(fieldIds.predecessor(i), "The predecessor must be exactly one character.");
    for (const [id, ctx] of [[fieldIds.contextL(i), rule.contextL], [fieldIds.contextR(i), rule.contextR]] as const)
      if (ctx.length > 1) e.set(id, 'Use "*" (any), a single character, or leave empty (legacy presets).');
    if (rule.successors.length === 0) e.set(fieldIds.rule(i), "Add at least one successor.");
    let total = 0, ok = true;
    rule.successors.forEach((sc, j) =>
    {
      const w = num(sc.weight);
      if (!Number.isFinite(w) || w < 0) { e.set(fieldIds.weight(i, j), "The weight must be a number of at least 0."); ok = false; }
      else total += w;
    });
    if (ok && total > 1 + 1e-9) rule.successors.forEach((_, j) => e.set(fieldIds.weight(i, j), `The weights of this rule add up to ${Math.round(total * 1e9) / 1e9}; they must not exceed 1.`));
  });
  return e;
}

export type BuildResult = { ok: true; ruleSet: RuleSet } | { ok: false; errors: FieldErrors };

// Converts to an engine RuleSet iff everything validates, using exactly the typed values.
export function buildRuleSet(s: EditorState, name = "-"): BuildResult
{
  const errors = validateState(s);
  if (errors.size === 0)
  {
    const rules = s.rules.map(r => new Rule(r.predecessor, r.successors.map(x => new Successor(x.successor, Number(x.weight))), r.contextL, r.contextR));
    const ruleSet = new RuleSet(name, s.axiom, Number(s.theta), Number(s.factor), rules, s.ignore.split(","));
    // Backstop: anything the engine rejects that the field checks missed is reported on the whole form.
    const engine = validateRuleSet(ruleSet);
    if (engine.length === 0) return { ok: true, ruleSet };
    engine.forEach((m, i) => errors.set(`form${i}`, m));
  }
  return { ok: false, errors };
}
