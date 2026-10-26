import { Line } from "./model";
import type { Bounds } from "./turtle";

// Bounds start at the canvas centre and grow as lines are traced (main.ts Initiate).
export function initialBounds(canvasWidth: number, canvasHeight: number): Bounds
{
  const x = canvasWidth / 2, y = canvasHeight / 2;
  return { minX: x, maxX: x, minY: y, maxY: y };
}

// Offset applied when drawing a non-forest tree (moved unchanged from main.ts Draw).
export function drawOffset(b: Bounds, first: Line)
{
  let offsetX = ((b.maxX - b.minX)) / 2;
  let offsetY = ((b.maxY - b.minY)) / 2;

  offsetX -= (b.maxX - first.start.x);
  offsetY -= (b.maxY - first.start.y);
  return { offsetX, offsetY };
}
