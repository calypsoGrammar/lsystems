import { Line, Transform, Vector } from "./model";
import type { RandomSource } from "./rewrite";

export interface Bounds { minX: number; maxX: number; minY: number; maxY: number; }

// Start position of tree `index` in forest mode (moved unchanged from main.ts GetLines).
// Consumes two random values per call, in this order: offset, then side.
export function forestStart(canvasWidth: number, canvasHeight: number, count: number, index: number, random: RandomSource = Math.random)
{
  let startX = parseFloat( (canvasWidth/2).toFixed(2) ) ;
  let startY = parseFloat( (canvasHeight).toFixed(2) ) ;

  let divide = (canvasWidth * 0.8) / count;
  let dif = Math.floor(random() * divide) * index;

  if(random() < 0.5)
  {
    startX += dif;
  }
  else
  {
    startX -= dif;
  }
  return new Vector(startX, startY);
}

// Interprets F/G (draw), f (move), +/- (rotate), [ ] (push/pop) from `start` heading 270 degrees
// (moved unchanged from main.ts GetLines/GetLine/MoveLine/RotateTransform). `bounds` is extended in place.
export function traceLines(current: string, len: number, theta: number, start: Vector, bounds: Bounds, round: boolean = true): Line[]
{
  const snap = round ? (v: number) => parseFloat(v.toFixed(2)) : (v: number) => v;
  const lines: Line[] = [];
  const matrix: Transform[] = [];
  let cT = new Transform(new Vector(start.x, start.y), 270); // reset

  for (let i = 0; i < current.length; i++)
  {
    let c = current.charAt(i);
    if (c == "F" || c == "G")
    {
      let newLine = GetLine(cT, len, bounds, snap);
      lines.push(newLine);
      MoveLine(cT, len, snap);
    }
    else if (c == "f")
    {
      MoveLine(cT, len, snap);
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

  // A segment is a branch start when another segment starts at the same point (one pass, O(n)).
  const startCounts = new Map<string, number>();
  for (const l of lines)
  {
    const key = l.start.x + "," + l.start.y;
    startCounts.set(key, (startCounts.get(key) ?? 0) + 1);
  }
  for (const l of lines)
  {
    if (startCounts.get(l.start.x + "," + l.start.y)! > 1) l.branchStart = true;
  }
  return lines;
}

function GetLine(transform: Transform, length: number, bounds: Bounds, snap: (v: number) => number)
{
  let startVector = new Vector(transform.pos.x, transform.pos.y);
  
  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);

  endX = snap(endX);
  endY = snap(endY);

  let endVector = new Vector(endX, endY);

  // max X
  if(startVector.x > bounds.maxX) bounds.maxX = startVector.x;
  if(endVector.x > bounds.maxX) bounds.maxX = endVector.x;
  // max Y
  if(startVector.y > bounds.maxY) bounds.maxY = startVector.y;
  if(endVector.y > bounds.maxY) bounds.maxY = endVector.y;

  // min X
  if(startVector.x < bounds.minX) bounds.minX = startVector.x;
  if(endVector.x < bounds.minX) bounds.minX = endVector.x;
  // min Y
  if(startVector.y < bounds.minY) bounds.minY = startVector.y;
  if(endVector.y < bounds.minY) bounds.minY = endVector.y;

  let resultLine = new Line(new Vector(startVector.x, startVector.y), 
  new Vector(endVector.x, endVector.y));
  resultLine.rot = transform.rot;

  return resultLine;
}

function MoveLine(transform: Transform, length: number, snap: (v: number) => number)
{
  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);
  transform.pos.x = snap(endX);
  transform.pos.y = snap(endY);
}

export function RotateTransform(transform: Transform, ang: number)
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
  transform.rot = newA;
}

// Pure, canvas-free interpretation in logical coordinates at full precision (no 2 dp rounding).
// Returns the segments (with leaf/branchStart/rot metadata) and the bounds of the drawable segments only,
// or `bounds: null` when nothing is drawn. Heading 270 degrees is up, y grows downwards, as in traceLines.
export function interpretTurtle(current: string, len: number, theta: number, start: Vector = new Vector(0, 0))
{
  const bounds: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const lines = traceLines(current, len, theta, start, bounds, false);
  return { lines, bounds: lines.length > 0 ? bounds : null };
}
