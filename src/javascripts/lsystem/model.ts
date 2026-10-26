export class Colour
{
  r: number = 0;
  g: number = 0;
  b: number = 0;
  constructor(r:number, g:number, b:number)
  {
    this.r = r;
    this.g = g;
    this.b = b;
  }
}

export class Line
{
  start: Vector = new Vector(0, 0);
  end: Vector = new Vector(0, 0);
  leaf: boolean = false;
  branchStart: boolean = false;
  rot: number = 0;

  constructor(a:Vector, b:Vector) // vector, vector
  {
    this.start = a;
    this.end = b;
    this.leaf = false; // determine if the position is the end of a line in branching systems
    this.branchStart = false // to store branching colors
    this.rot = 0; // store rotation
  }
}

export class Vector
{
  x: number = 0;
  y: number = 0;
  constructor(x:number, y:number)
  {
    this.x = x;
    this.y = y;
  }
}

export class Transform
{
  pos: Vector = new Vector(0, 0);
  rot: number = 0;
  constructor(pos:Vector, rot:number)
  {
    this.pos = new Vector(pos.x, pos.y);
    this.rot = rot;
  }
}

export class Successor
{
  successor: string = "";
  weight: number = 0;
  constructor(successor:string, weight:number)
  {
    this.successor = successor;
    this.weight = weight;
  }
}

export class Rule
{
  predecessor: string = "";
  successors: Successor[] = [];
  contextL: string = "";
  contextR: string = "";
  constructor(predecessor:string, successors:Successor[], contextL:string, contextR:string)
  {
    this.predecessor = predecessor; // the main trigger char
    this.successors = successors; // the replacements and their probability weighting
    this.contextL = contextL; // left context for activation
    this.contextR = contextR; // right context
  }
}

export class RuleSet
{
  name: string = "";
  start: string = "";
  theta: number = 0;
  factor: number = 0;
  rules: Rule[] = [];
  ignore: string[] = [''];
  constructor(name:string, start:string, theta:number, factor:number, rules:Rule[], ignore:string[]) 
  {
    this.name = name;
    this.start = start; // the starting statement
    this.theta = theta; // rotation angle
    this.factor = factor; // how much the length reduces per iteration
    this.rules = rules; // stores the rules in an array
    this.ignore = ignore; // string of ignore characters when considering context
  }
}
