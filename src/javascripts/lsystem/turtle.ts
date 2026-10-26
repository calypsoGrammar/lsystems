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
export function traceLines(current: string, len: number, theta: number, start: Vector, bounds: Bounds): Line[]
{
  const lines: Line[] = [];
  const matrix: Transform[] = [];
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

function GetLine(transform: Transform, length: number, bounds: Bounds)
{
  let startVector = new Vector(transform.pos.x, transform.pos.y);
  
  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);

  endX = parseFloat( endX.toFixed(2) ) ;
  endY = parseFloat( endY.toFixed(2) ) ;

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

function MoveLine(transform: Transform, length: number)
{
  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);
  transform.pos.x = parseFloat( endX.toFixed(2) ) ;
  transform.pos.y = parseFloat( endY.toFixed(2) ) ;
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
