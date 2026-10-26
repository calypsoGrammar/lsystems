import { Bounds, Line, RandomSource, Rule, RuleSet, Successor, TraceTurtle, Vector } from "../src/javascripts/lsystem";

// mulberry32: small seeded generator so stochastic scenarios are reproducible.
export function seeded(seed: number): RandomSource
{
  return () =>
  {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns the given values in order, then throws, so a test also proves how many draws were made.
export function sequence(...values: number[]): RandomSource
{
  let i = 0;
  return () =>
  {
    if(i >= values.length) throw new Error("random source exhausted after " + values.length + " draws");
    return values[i++];
  };
}

// Single-successor rule. Contexts default to "*" (any), as GetSystem builds them.
export function rule(predecessor: string, successor: string, contextL: string = "*", contextR: string = "*"): Rule
{
  return new Rule(predecessor, [new Successor(successor, 1)], contextL, contextR);
}

export function weighted(predecessor: string, ...successors: [string, number][]): Rule
{
  return new Rule(predecessor, successors.map(([s, w]) => new Successor(s, w)), "*", "*");
}

export function system(start: string, rules: Rule[], ignore: string[] = [''], theta: number = 90): RuleSet
{
  return new RuleSet("test", start, theta, 4, rules, ignore);
}

export function freshBounds(x: number, y: number): Bounds
{
  return { minX: x, maxX: x, minY: y, maxY: y };
}

// Runs the turtle from the origin; bounds start at the origin like the app's canvas centre.
export function trace(commands: string, theta: number = 90, len: number = 10, x: number = 0, y: number = 0): { lines: Line[], bounds: Bounds }
{
  let bounds = freshBounds(x, y);
  let lines = TraceTurtle(commands, theta, len, new Vector(x, y), bounds);
  return { lines, bounds };
}

// Segment endpoints rounded away from -0 so toEqual comparisons stay readable.
export function segments(lines: Line[]): number[][]
{
  return lines.map(l => [l.start.x, l.start.y, l.end.x, l.end.y].map(v => v + 0));
}
