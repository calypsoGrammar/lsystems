// Scene building and playback (CAL-1275). Browser-free.
import { describe, expect, it } from "vitest";
import { Colour, Line, Vector } from "../src/javascripts/lsystem/model";
import { buildScene, displayText, nextSection, leafMask, MAX_DISPLAY_CHARS, MAX_SEGMENTS, SegmentLimitError, walkColours } from "../src/javascripts/lsystem/scene";
import { Playback, type Scheduler } from "../src/javascripts/lsystem/playback";
import { fitTransform } from "../src/javascripts/lsystem/fit";
import { seeded } from "./helpers";

const colour = { base: new Colour(10, 20, 30), variance: 20 };

function fakeScheduler()
{
  let t = 0, next = 1;
  const pending = new Map<number, (n: number) => void>();
  const s: Scheduler = {
    request: cb => { pending.set(next, cb); return next++; },
    cancel: h => { pending.delete(h); },
    now: () => t,
  };
  return {
    s, pending,
    tick(ms: number) { t += ms; const cbs = [...pending.values()]; pending.clear(); cbs.forEach(cb => cb(t)); },
  };
}

describe("scene", () =>
{
  it("is reproducible from the scene: refitting needs no random source", () =>
  {
    const scene = buildScene([{ generation: "F[+F]F[-F]F", length: 10 }], 25, false, 800, 600, colour, seeded(3));
    const a = fitTransform(scene.bounds, 1000, 500)!, b = fitTransform(scene.bounds, 400, 700)!;
    expect(a.scale).not.toBe(b.scale);
    const again = buildScene([{ generation: "F[+F]F[-F]F", length: 10 }], 25, false, 800, 600, colour, seeded(3));
    expect(again.trees[0].colours).toEqual(scene.trees[0].colours);
    expect(again.bounds).toEqual(scene.bounds);
  });

  it("keeps independent per-tree bounds and an aggregate covering all of them", () =>
  {
    const scene = buildScene([1, 2, 3].map(() => ({ generation: "FF[+F]F", length: 20 })), 30, true, 900, 600, colour, seeded(5));
    expect(scene.trees).toHaveLength(3);
    for (const t of scene.trees)
    {
      expect(t.bounds).not.toBeNull();
      expect(t.bounds!.minX).toBeGreaterThanOrEqual(scene.bounds!.minX);
      expect(t.bounds!.maxX).toBeLessThanOrEqual(scene.bounds!.maxX);
      expect(t.bounds!.minY).toBeGreaterThanOrEqual(scene.bounds!.minY);
      expect(t.bounds!.maxY).toBeLessThanOrEqual(scene.bounds!.maxY);
      expect(t.colours).toHaveLength(t.lines.length);
    }
  });

  it("handles empty and move-only trees", () =>
  {
    const scene = buildScene([{ generation: "", length: 5 }, { generation: "ff", length: 5 }], 20, true, 500, 500, colour, seeded(1));
    expect(scene.segments).toBe(0);
    expect(scene.bounds).toBeNull();
  });

  it("draws leaves only where no segment starts, in linear time", () =>
  {
    const lines = [new Line(new Vector(0, 0), new Vector(0, -1)), new Line(new Vector(0, -1), new Vector(0, -2)), new Line(new Vector(0, -1), new Vector(1, -1))];
    lines[1].leaf = true; lines[2].leaf = true;
    lines[0].leaf = true; // end (0,-1) is where others start: no leaf
    expect([...leafMask(lines)]).toEqual([0, 1, 1]);
  });

  it("clamps colours and uses variance 0 as a constant colour", () =>
  {
    expect(new Set(walkColours(50, { base: new Colour(5, 5, 5), variance: 0 })).size).toBe(1);
    for (const c of walkColours(500, { base: new Colour(0, 255, 128), variance: 300 }, seeded(2)))
      for (const n of c.match(/\d+/g)!) expect(+n).toBeLessThanOrEqual(255);
  });

  it("refuses scenes over the segment limit", () =>
  {
    expect(() => buildScene([{ generation: "F".repeat(MAX_SEGMENTS + 1), length: 1 }], 0, false, 1, 1, colour)).toThrow(SegmentLimitError);
  });

  it("truncates huge generations for display", () =>
  {
    expect(displayText("F")).toBe("F");
    expect(displayText("F".repeat(MAX_DISPLAY_CHARS + 50)).length).toBeLessThan(MAX_DISPLAY_CHARS + 100);
  });
});

describe("generated string inspection", () =>
{
  it("reveals the whole generation section by section without losing symbols", () =>
  {
    const text = "F+-[]".repeat(10);
    let shown = 0, out = "", sections = 0, remaining = text.length;
    while (remaining > 0)
    {
      const part = nextSection(text, shown, 7);
      expect(part.text.length).toBeLessThanOrEqual(7);
      out += part.text; shown = part.shown; remaining = part.remaining; sections++;
    }
    expect(out).toBe(text);
    expect(sections).toBe(Math.ceil(text.length / 7));
    expect(nextSection("", 0).remaining).toBe(0);
  });
});

describe("playback", () =>
{
  it("plays every segment of every tree in order and finishes once", () =>
  {
    const f = fakeScheduler(), seen: string[] = []; let done = 0;
    new Playback(f.s).start({ counts: [3, 0, 2], intervalMs: 10, draw: (t, i) => seen.push(t + ":" + i), onDone: () => done++ });
    for (let i = 0; i < 20; i++) f.tick(10);
    expect(seen).toEqual(["0:0", "0:1", "0:2", "2:0", "2:1"]);
    expect(done).toBe(1);
    expect(f.pending.size).toBe(0);
  });

  it("honours the interval", () =>
  {
    const f = fakeScheduler(); let n = 0;
    new Playback(f.s).start({ counts: [100], intervalMs: 50, draw: () => n++ });
    f.tick(16); expect(n).toBe(0);
    f.tick(100); expect(n).toBe(2);
  });

  it("never has more than one pending frame across restarts and cancels", () =>
  {
    const f = fakeScheduler(), p = new Playback(f.s); let drawn = 0;
    for (let i = 0; i < 5; i++) p.start({ counts: [10], intervalMs: 5, draw: () => drawn++ });
    expect(f.pending.size).toBe(1);
    p.cancel();
    expect(f.pending.size).toBe(0);
    f.tick(100);
    expect(drawn).toBe(0);
  });

  it("pauses and resumes without losing its place", () =>
  {
    const f = fakeScheduler(), seen: number[] = []; const p = new Playback(f.s);
    p.start({ counts: [4], intervalMs: 10, draw: (_t, i) => seen.push(i) });
    f.tick(20); p.pause(); f.tick(100);
    expect(seen).toEqual([0, 1]);
    p.resume(); f.tick(100); f.tick(100);
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it("draws instantly-scheduled scenes in bounded slices", () =>
  {
    const f = fakeScheduler(); let n = 0;
    new Playback(f.s).start({ counts: [10000], intervalMs: 0, maxPerFrame: 1000, draw: () => n++ });
    f.tick(16); expect(n).toBe(1000);
    for (let i = 0; i < 10; i++) f.tick(16);
    expect(n).toBe(10000);
  });
});
