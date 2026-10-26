import { RuleSet } from "./model";
import { ExpansionLimitError, MAX_GENERATION_SYMBOLS, rewrite, type RandomSource } from "./rewrite";

export { ExpansionLimitError, MAX_GENERATION_SYMBOLS };
export type { RandomSource };

// Iterations above this are rejected (lengths shrink by `factor` each generation, so they draw nothing useful anyway).
export const MAX_ITERATIONS = 25;
// Cap on the symbols of all generations of one tree together (the UI prints every generation).
export const MAX_TOTAL_SYMBOLS = 2_000_000;
// Slack for weights that are meant to sum to 1 (e.g. 0.34 + 0.33 + 0.33).
const WEIGHT_EPSILON = 1e-9;

export class GrammarError extends Error
{
  constructor(public readonly problems: string[])
  {
    super(problems.join("\n"));
    this.name = "GrammarError";
  }
}

// Returns a list of human-readable problems; empty means the grammar is valid.
//  * predecessor: exactly one character.
//  * contexts: "*" (anything), "" (legacy: only matches where the check is skipped) or a single character.
//  * weights: finite, >= 0, summing to at most 1. A total below 1 is allowed: the remaining probability leaves the
//    symbol unchanged. A rule with no successors is allowed and leaves its symbol unchanged.
//  * factor: finite and > 0 (it divides the line length each iteration); theta: finite.
export function validateRuleSet(rs: RuleSet): string[]
{
  const problems: string[] = [];
  if (typeof rs.start !== "string") problems.push("The axiom must be a string.");
  if (!Number.isFinite(rs.theta)) problems.push("The angle must be a number.");
  if (!Number.isFinite(rs.factor) || rs.factor <= 0) problems.push("The length factor must be a number above 0.");
  if (!Array.isArray(rs.ignore) || rs.ignore.some(x => typeof x !== "string")) problems.push("The ignore list must be a list of strings.");
  rs.rules.forEach((rule, i) =>
  {
    const label = `Rule ${i + 1}`;
    if (rule.predecessor.length !== 1) problems.push(`${label}: the predecessor must be exactly one character (got "${rule.predecessor}").`);
    for (const [side, ctx] of [["left", rule.contextL], ["right", rule.contextR]] as const)
      if (ctx !== undefined && ctx !== "*" && ctx.length > 1)
        problems.push(`${label}: the ${side} context must be "*" or a single character (got "${ctx}").`);
    let total = 0;
    let weightsOk = true;
    rule.successors.forEach((s, j) =>
    {
      if (!Number.isFinite(s.weight) || s.weight < 0)
      {
        problems.push(`${label}, successor ${j + 1}: the weight must be a number of at least 0.`);
        weightsOk = false;
      }
      else total += s.weight;
    });
    if (weightsOk && total > 1 + WEIGHT_EPSILON)
      problems.push(`${label}: the successor weights add up to ${total}, which is more than 1.`);
  });
  return problems;
}

export function validateIterations(iterations: number): string[]
{
  if (!Number.isInteger(iterations) || iterations < 0 || iterations > MAX_ITERATIONS)
    return [`Iterations must be a whole number from 0 to ${MAX_ITERATIONS}.`];
  return [];
}

// Pure expansion of `iterations` generations. Returns every generation (index 0 is the axiom) and never returns a
// partial result: it throws GrammarError (invalid input) or ExpansionLimitError (too large) instead.
export function expandGrammar(rs: RuleSet, iterations: number, random: RandomSource = Math.random): string[]
{
  const problems = [...validateRuleSet(rs), ...validateIterations(iterations)];
  if (problems.length > 0) throw new GrammarError(problems);
  if (rs.start.length > MAX_GENERATION_SYMBOLS)
    throw new ExpansionLimitError(`The axiom exceeds the limit of ${MAX_GENERATION_SYMBOLS} symbols.`);

  const generations = [rs.start];
  let total = rs.start.length;
  for (let i = 0; i < iterations; i++)
  {
    const next = rewrite(rs, generations[i], random);
    total += next.length;
    if (total > MAX_TOTAL_SYMBOLS)
      throw new ExpansionLimitError(`Expansion exceeds the limit of ${MAX_TOTAL_SYMBOLS} symbols over all generations.`);
    generations.push(next);
  }
  return generations;
}
