// Pure L-system model, rewrite and turtle code. No DOM or canvas access, so it can be
// imported by tests. Extracted unchanged from main.ts (CAL-1271); known defects are
// deliberately preserved and recorded in tests/known-defects.test.ts and docs/AUDIT.md.

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

// A source of numbers in [0, 1); Math.random in the app, a seeded generator in tests.
export type RandomSource = () => number;

export interface Bounds
{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// One rewrite pass over `current` (the body of the original Iterate, minus the length
// reduction and the output view).
export function Rewrite(ruleset: RuleSet, current: string, random: RandomSource = Math.random): string
{
  let next = "";
  for (let i = 0; i < current.length; i++) // for each character in current
  {
    let c = current.charAt(i);
    let triggered = false;
    for(let r = 0; r < ruleset.rules.length; r++) // compare it against each rule
    {
      if(c == ruleset.rules[r].predecessor) // compare it against each predecessor
      {
        let contextL = ruleset.rules[r].contextL;
        let contextR = ruleset.rules[r].contextR;

        if(contextL !== undefined && i > 1 && ruleset.ignore !== undefined && contextL !== "*")
        {
          let leftC = current.charAt(i - 1);

          if(leftC === "]")
          {
            let counter = i;
            let increment = 1;
            let newChar = "";
            while (counter > 0)
            {
              increment++;
              newChar = current.charAt(i - increment);
              if(newChar === "[")
              {
                increment++;
                leftC = current.charAt(i - increment);
                break;
              }
              counter--;
            }
          }

          if(leftC !== contextL && !ruleset.ignore.includes(leftC))
          {
            continue;
          }
        }

        if(contextR !== undefined && i < (current.length - 1) && ruleset.ignore !== undefined && contextR !== "*")
        {
          let rightC = current.charAt(i + 1);

          if(rightC === "[")
          {
            let counter = i;
            let increment = 1;
            let newChar = "";
            while (counter < current.length)
            {
              increment++;
              newChar = current.charAt(i + increment);
              if(newChar === "]")
              {
                increment++;
                rightC = current.charAt(i + increment);
                break;
              }
              counter++;
            }
          }

          if(rightC !== contextR && !ruleset.ignore.includes(rightC))
          {
            continue;
          }
        }

        if(ruleset.rules[r].successors.length > 0) // if > 0 successors find the relevant one by
        {
          let pick = random(); // picking random value between 0-1
          let counter = 0;
          for(let s = 0; s < ruleset.rules[r].successors.length; s++) // then go through each successor till find matching weight
          {
            counter += ruleset.rules[r].successors[s].weight;
            if(counter >= pick)
            {
              next += ruleset.rules[r].successors[s].successor;
              triggered = true;
              break;
            }
          }
        }
        else
        {
          next += ruleset.rules[r].successors[0].successor; // else add the first successor if the only one
          triggered = true;
        }
      }
    }
    if(!triggered) next += c; // if no replacement, add the original character
  }
  return next;
}

// Where a tree starts: the canvas centre, or (forest) a random spot along the bottom edge.
// Random calls happen in the original order: offset first, then direction.
export function StartPosition(width: number, height: number, forest: boolean, count: number, index: number, random: RandomSource = Math.random): Vector
{
  let startX = parseFloat( (width/2).toFixed(2) ) ;
  let startY = parseFloat( (height/2).toFixed(2) ) ;

  if(forest)
  {
    startY = parseFloat( (height).toFixed(2) ) ;

    let divide = (width * 0.8) / count;
    let dif = Math.floor(random() * divide) * index;

    if(random() < 0.5)
    {
      startX += dif;
    }
    else
    {
      startX -= dif;
    }
  }

  return new Vector(startX, startY);
}

// Interprets F/G (draw), f (move), +/- (rotate by theta), [ ] (push/pop) from `start`,
// heading 270 degrees (up). `bounds` is updated in place with every drawn segment.
export function TraceTurtle(current: string, theta: number, len: number, start: Vector, bounds: Bounds): Line[]
{
  let lines: Line[] = [];
  let matrix: Transform[] = []; // to store transform history
  let cT = new Transform(new Vector(start.x, start.y), 270); // reset

  for (let i = 0; i < current.length; i++)
  {
    let c = current.charAt(i);
    if (c == "F" || c == "G")
    {
      let newLine = GetLine(cT, len, bounds);
      lines.push(newLine);
      MoveLine(cT, len);
    }
    else if (c == "f")
    {
      MoveLine(cT, len);
    }
    else if (c == "+")
    {
      RotateTransform(cT, theta);
    }
    else if (c == "-")
    {
      RotateTransform(cT, -theta);
    }
    else if (c == "[")
    {
      let saveT = new Transform(new Vector(cT.pos.x, cT.pos.y), cT.rot);
      matrix.push(saveT);
    }
    else if (c == "]")
    {
      if(matrix.length > 0)
      {
        cT = matrix[matrix.length-1];
        matrix.length = matrix.length -1;
        if(lines.length > 0) lines[lines.length - 1].leaf = true;
      }
    }
  }

  if(lines.length > 0)
  {
    lines[lines.length - 1].leaf = true;
  }

  for (let i = 0; i < lines.length; i++)
  {
    let valid = false;
    for (let c = 0; c < lines.length; c++)
    {
      if(lines[i].start.x === lines[c].start.x &&
        lines[i].start.y === lines[c].start.y && i !== c)
      {
        valid = true;
        break;
      }
    }
    if(valid)
    {
      lines[i].branchStart = true;
    }
  }

  return lines;
}

export function GetLine(transform: Transform, length: number, bounds: Bounds)
{
  let startVector = new Vector(transform.pos.x, transform.pos.y);

  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);

  endX = parseFloat( endX.toFixed(2) ) ;
  endY = parseFloat( endY.toFixed(2) ) ;

  let endVector = new Vector(endX, endY);

  // get pos

  // max X
  if(startVector.x > bounds.maxX) bounds.maxX = startVector.x;
  if(endVector.x > bounds.maxX) bounds.maxX = endVector.x;
  // max Y
  if(startVector.y > bounds.maxY) bounds.maxY = startVector.y;
  if(endVector.y > bounds.maxY) bounds.maxY = endVector.y;

  // min X
  if(startVector.x < bounds.minX) bounds.minX = startVector.x;
  if(endVector.x < bounds.minX) bounds.minX = endVector.x;
  // max Y
  if(startVector.y < bounds.minY) bounds.minY = startVector.y;
  if(endVector.y < bounds.minY) bounds.minY = endVector.y;

  let resultLine = new Line(new Vector(startVector.x, startVector.y),
  new Vector(endVector.x, endVector.y));
  resultLine.rot = transform.rot;

  return resultLine;
}

export function MoveLine(transform: Transform, length: number)
{
  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);
  transform.pos.x = parseFloat( endX.toFixed(2) ) ;
  transform.pos.y = parseFloat( endY.toFixed(2) ) ;
}

export function RotateTransform(transform: Transform, ang: number) // updates the rotation to a transform clockwise angle
{
  let newA = transform.rot + ang;
  if(newA >= 360)
  {
    let dif = 360 - newA;
    newA = 360 - dif;
  }
  if(newA < 0)
  {
    newA = 360 + newA;
  }
  return new Transform(
  new Vector(transform.pos.x, transform.pos.y),
  (transform.rot = newA)
  );
};

// Offset applied when drawing a single (non-forest) tree so it is centred on the canvas.
// Throws a TypeError when `first` is undefined (a system that draws no line), as Draw did.
export function CentreOffset(bounds: Bounds, first: Line): Vector
{
  let offsetX = ((bounds.maxX - bounds.minX)) / 2;
  let offsetY = ((bounds.maxY - bounds.minY)) / 2;

  offsetX -= (bounds.maxX - first.start.x);
  offsetY -= (bounds.maxY - first.start.y);

  return new Vector(offsetX, offsetY);
}
