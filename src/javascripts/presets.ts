import { Rule, RuleSet, Successor } from "./lsystem";

export const lSystems: RuleSet[] = [];

let kochIsland = new RuleSet(
"Koch Island",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [new Rule("F", [ new Successor("F-F+F+FF-F-F+F", 1) ], '*', '*') ], ['']);
lSystems.push(kochIsland);

let kochCurve1 = new RuleSet(
"Koch Curve 2",
"-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F+F-F-F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(kochCurve1);

let lakesAndIslands = new RuleSet(
"Lakes and Islands",
"F+F+F+F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F+f-FF+F+FF+Ff+FF-f+FF-F-FF-Ff-FFF", 1)
  ], '*', '*'),
  new Rule("f",  [
    new Successor("ffffff", 1)
  ], '*', '*')
], ['']);
lSystems.push(lakesAndIslands);

let ruleset1 = new RuleSet(
"Ruleset 1",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F-F-F-F-F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset1);

let ruleset2 = new RuleSet(
"Ruleset 2",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F-F-F-FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset2);

let ruleset3 = new RuleSet(
"Ruleset 3",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F+F-F-FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset3);

let ruleset4 = new RuleSet(
"Ruleset 4",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F--F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset4);

let ruleset5 = new RuleSet(
"Ruleset 5",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F-FF--F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset5);

let ruleset6 = new RuleSet(
"Ruleset 6",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F-F+F-F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset6);

let dragoncurve = new RuleSet(
"Dragon Curve",
"FX", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("X+YF+", 1)
  ], '*', '*'),
  new Rule("Y",  [
    new Successor("-FX-Y", 1)
  ], '', '')
], ['']);
lSystems.push(dragoncurve);

let sierpinkskiCurve = new RuleSet(
"Sierpinski Curve",
"F--XF--F--XF", // start
45, // theta
4, // length reduction factor
 [
  new Rule("X",  [
    new Successor("XF+G+XF--F--XF+G+X", 1)
  ], '*', '*')
], ['']);
lSystems.push(sierpinkskiCurve);

let sierpinkskiTriangle = new RuleSet(
"Sierpinkski Triangle",
"F-G-G", // start
120, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F-G+F+G-F", 1)
  ], '*', '*'),
  new Rule("G",  [
    new Successor("GG", 1)
  ], '*', '*')
], ['']);
lSystems.push(sierpinkskiTriangle);

// Defined but never registered in the menu (see docs/AUDIT.md); kept so it is not lost.
export const unregisteredPresets: RuleSet[] = [];

let cantorSet = new RuleSet(
"Cantor Set",
"F", // start
45, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FfF", 1)
  ], '*', '*'),
  new Rule("f",  [
    new Successor("fff", 1)
  ], '*', '*')
], ['']);

unregisteredPresets.push(cantorSet);

let kochCurve = new RuleSet(
"Koch Curve 1",
"F", // start
60, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F+F--F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(kochCurve);

let kochSnowflake = new RuleSet(
"Koch Snowflake",
"F--F--F", // start
60, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F+F--F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(kochSnowflake);

let hilbertCurve = new RuleSet(
"Hilbert Curve",
"A", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("A",  [
    new Successor("+BF-AFA-FB+", 1)
  ], '*', '*'),
  new Rule("B",  [
    new Successor("-AF+BFB+FA-", 1)
  ], '*', '*')
], ['']);
lSystems.push(hilbertCurve);

let levyCCurve = new RuleSet(
"Levy C Curve",
"F", // start
45, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("+F--F+", 1)
  ], '*', '*')
], ['']);
lSystems.push(levyCCurve);

let star = new RuleSet(
"Star",
"F", // start
77, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F++F", 1)
  ], '*', '*')
], ['']);
lSystems.push(star);

let pentigree = new RuleSet(
"Pentigree Curve",
"F-F-F-F-F", // start
72, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F-F-F++F+F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(pentigree);

let snowflake = new RuleSet(
"Snowflake",
"F++F++F++F++F", // start
36, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F++F++F+++++F-F++F", 1)
  ], '*', '*')
], ['']);
lSystems.push(snowflake);

let gosperCurve = new RuleSet(
"Gosper Curve",
"F", // start
60, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F-G--G+F++FF+G-", 1)
  ], '*', '*'),
  new Rule("G",  [
    new Successor("+F-GG--G-F++F+G", 1)
  ], '*', '*')
], ['']);
lSystems.push(gosperCurve);

// Bracketed

let fractalPlant = new RuleSet(
"Fractal Plant 1",
"X", // start
25, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("F+[[X]-X]-F[-FX]+X", 1)
  ], '*', '*'),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant);

let fractalPlant1 = new RuleSet(
"Fractal Plant 2",
"F", // start
25.7, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F[+F]F[-F]F", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant1);

let fractalPlant2 = new RuleSet(
"Fractal Plant 3",
"F", // start
22.5, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-[-F+F+F]+[+F-F-F]", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant2);

let fractalPlant3 = new RuleSet(
"Fractal Plant 4",
"F", // start
20, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F[+F]F[-F][F]", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant3);

let fractalPlant4 = new RuleSet(
"Fractal Plant 5",
"X", // start
20, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("F[+X]F[-X]+X", 1)
  ], '*', '*'),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant4);

let fractalPlant5 = new RuleSet(
"Fractal Plant 6",
"X", // start
25.7, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("F[+X][-X]FX", 1)
  ], '*', '*'),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant5);

let fractalPlant6 = new RuleSet(
"Fractal Plant 7",
"X", // start
22.5, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("[[X]+X]+F[+FX]-X", 1)
  ], '', ''),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant6);

// Stochastic

let fractalPlant7 = new RuleSet(
"Fractal Plant 8",
"F", // start
20, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F[+F]F[-F]F", 0.34),
    new Successor("F[+F]F", 0.33),
    new Successor("F[-F]F", 0.33)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant7);

// Context sensitive

let fractalPlant8 = new RuleSet(
"Fractal Plant 9",
"F1F1F1", // start
22.5, // theta
4, // length reduction factor
 
[

// 1
new Rule(
"0", //predecessor
 [new Successor("0", 1)], // successor array
"0", // left context
"0" // right context
),

// 2
new Rule(
"0", //predecessor
 [new Successor("1[+F1F1]", 1)], // successor array
"0", // left context
"1" // right context
),

// 3
new Rule(
"1", //predecessor
 [new Successor("1", 1)], // successor array
"0", // left context
"0" // right context
),

// 4
new Rule(
"1", //predecessor
 [new Successor("1", 1)], // successor array
"0", // left context
"1" // right context
),


// 5
new Rule(
"0", //predecessor
 [new Successor("0", 1)], // successor array
"1", // left context
"0" // right context
),


// 6
new Rule(
"0", //predecessor
 [new Successor("1F1", 1)], // successor array
"1", // left context
"1" // right context
),

// 7
new Rule(
"1", //predecessor
 [new Successor("0", 1)], // successor array
"1", // left context
"0" // right context
),

// 8
new Rule(
"1", //predecessor
 [new Successor("0", 1)], // successor array
"1", // left context
"1" // right context
),

// 9
new Rule(
"+", //predecessor
 [new Successor("-", 1)], // successor array
"*", // left context
"*" // right context
),

// 10
new Rule(
"-", //predecessor
 [new Successor("+", 1)], // successor array
"*", // left context
"*" // right context
)
],

["+", "-", "F"] // ignore list

);
lSystems.push(fractalPlant8);
