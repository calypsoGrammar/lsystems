import { RuleSet } from "./model";

export type RandomSource = () => number;

// Hard cap on the length of one generated string (and, in grammar.ts, on all generations of one tree together).
// Plain, DOM-free so tests and the UI share it. The largest preset output the UI draws today (Lakes and Islands,
// iteration 3) is ~47 000 symbols; the next iteration is already past this cap and would hang the drawing code.
export const MAX_GENERATION_SYMBOLS = 500_000;

export class ExpansionLimitError extends Error
{
  constructor(message: string)
  {
    super(message);
    this.name = "ExpansionLimitError";
  }
}

// Branch-aware neighbour lookup used for context matching.
//
// Left: the symbol immediately left of `i`. If that is "]", jump back over the whole bracketed branch (nesting is
// respected) and use the symbol just before its matching "[". Right: the symbol immediately right of `i`. If that is
// "[", jump forward over the whole branch and use the symbol just after its matching "]".
// A branch that is never closed/opened is not skipped: the bracket itself is returned and so (unless it is in the
// ignore list) the context does not match. Positions outside the string give "" (matched only if "" is ignored).
export function leftNeighbour(s: string, i: number): string
{
  let c = s.charAt(i - 1);
  if (c !== "]") return c;
  let depth = 0;
  for (let j = i - 1; j >= 0; j--)
  {
    const ch = s.charAt(j);
    if (ch === "]") depth++;
    else if (ch === "[" && --depth === 0) return s.charAt(j - 1); // j - 1 may be -1: charAt gives ""
  }
  return c;
}

export function rightNeighbour(s: string, i: number): string
{
  let c = s.charAt(i + 1);
  if (c !== "[") return c;
  let depth = 0;
  for (let j = i + 1; j < s.length; j++)
  {
    const ch = s.charAt(j);
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return s.charAt(j + 1);
  }
  return c;
}

// One rewriting generation. `random` defaults to Math.random; tests inject a seeded or scripted source.
//
// Every rule (in rule order) whose predecessor and contexts match contributes one successor, chosen exactly once per
// matching rule with a single draw of `random`. Rules are not exclusive (legacy behaviour kept so the presets draw
// as before): Fractal Plant 9 relies on two rules matching the same symbol next to an ignored one.
// The chosen successor is the first whose cumulative weight reaches the draw. If the draw lies beyond the total weight,
// or the rule has no successors, the symbol is kept unchanged. Contexts: "*" matches anything; the context check is
// skipped at positions 0 and 1 on the left and at the last position on the right (legacy behaviour, see AUDIT).
// Throws ExpansionLimitError as soon as the output would exceed `maxSymbols`.
export function rewrite(ruleset: RuleSet, current: string, random: RandomSource = Math.random,
  maxSymbols: number = MAX_GENERATION_SYMBOLS): string
{
  const parts: string[] = [];
  let size = 0;
  const emit = (text: string) =>
  {
    size += text.length;
    if (size > maxSymbols)
      throw new ExpansionLimitError(`Expansion exceeds the limit of ${maxSymbols} symbols per generation.`);
    parts.push(text);
  };

  const ignore = ruleset.ignore ?? [];
  for (let i = 0; i < current.length; i++)
  {
    const c = current.charAt(i);
    let replacement: string | null = null; // null: no rule produced output, keep the symbol
    for (const rule of ruleset.rules)
    {
      if (c !== rule.predecessor) continue;

      if (rule.contextL !== undefined && i > 1 && ruleset.ignore !== undefined && rule.contextL !== "*")
      {
        const leftC = leftNeighbour(current, i);
        if (leftC !== rule.contextL && !ignore.includes(leftC)) continue;
      }
      if (rule.contextR !== undefined && i < current.length - 1 && ruleset.ignore !== undefined && rule.contextR !== "*")
      {
        const rightC = rightNeighbour(current, i);
        if (rightC !== rule.contextR && !ignore.includes(rightC)) continue;
      }

      if (rule.successors.length > 0)
      {
        const pick = random();
        let total = 0;
        for (const s of rule.successors)
        {
          total += s.weight;
          if (total >= pick) { replacement = (replacement ?? "") + s.successor; break; }
        }
      }
    }
    emit(replacement ?? c);
  }
  return parts.join("");
}
