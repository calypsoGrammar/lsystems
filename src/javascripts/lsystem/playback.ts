// A single cancellable playback cycle over the segments of several trees, driven by requestAnimationFrame.
// There is never more than one pending frame: start() and cancel() always cancel the previous one first.

export interface Scheduler
{
  request(cb: (now: number) => void): number;
  cancel(handle: number): void;
  now(): number;
}

export const browserScheduler: Scheduler = {
  request: cb => requestAnimationFrame(cb),
  cancel: h => cancelAnimationFrame(h),
  now: () => performance.now(),
};

export interface PlaybackOptions
{
  counts: number[];                              // segments per tree
  draw: (tree: number, segment: number) => void;
  intervalMs: number;                            // time per segment; 0 or less draws as fast as the budget allows
  frameBudgetMs?: number;                        // max time spent drawing in one frame
  maxPerFrame?: number;                          // cap on segments per frame (a cheap bound besides the clock)
  onDone?: () => void;
}

export class Playback
{
  private handle: number | null = null;
  private tree = 0;
  private segment = 0;
  private credit = 0;
  private last = 0;
  private paused = false;
  private opts: PlaybackOptions | null = null;
  private generation = 0;

  constructor(private readonly scheduler: Scheduler = browserScheduler) {}

  get running(): boolean { return this.handle !== null; }
  get pendingFrames(): number { return this.handle === null ? 0 : 1; }
  get finished(): boolean { return this.opts === null || this.atEnd(); }

  start(opts: PlaybackOptions): void
  {
    this.cancel();
    this.opts = opts;
    this.tree = 0; this.segment = 0; this.credit = 0; this.paused = false;
    this.skipEmpty();
    if (this.atEnd()) { this.complete(); return; }
    this.schedule();
  }

  cancel(): void
  {
    this.generation++;
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
    this.opts = null;
  }

  pause(): void
  {
    if (this.opts === null || this.paused) return;
    this.paused = true;
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  resume(): void
  {
    if (this.opts === null || !this.paused) return;
    this.paused = false;
    if (!this.atEnd()) this.schedule();
  }

  private atEnd(): boolean { return this.opts === null || this.tree >= this.opts.counts.length; }

  private skipEmpty(): void
  {
    const o = this.opts!;
    while (this.tree < o.counts.length && this.segment >= o.counts[this.tree]) { this.tree++; this.segment = 0; }
  }

  private schedule(): void
  {
    this.last = this.scheduler.now();
    const gen = this.generation;
    this.handle = this.scheduler.request(now => { if (gen === this.generation) this.frame(now); });
  }

  private frame(now: number): void
  {
    this.handle = null;
    const o = this.opts;
    if (o === null) return;
    const budget = o.frameBudgetMs ?? 12;
    const maxPer = o.maxPerFrame ?? 5000;
    let allowed = maxPer;
    if (o.intervalMs > 0)
    {
      this.credit += Math.max(0, now - this.last);
      allowed = Math.min(maxPer, Math.floor(this.credit / o.intervalMs));
      this.credit -= allowed * o.intervalMs;
      if (allowed === maxPer) this.credit = 0; // do not bank unlimited catch-up after a stall
    }
    this.last = now;
    const began = this.scheduler.now();
    let drawn = 0;
    while (drawn < allowed && !this.atEnd())
    {
      o.draw(this.tree, this.segment++);
      drawn++;
      this.skipEmpty();
      if (drawn % 64 === 0 && this.scheduler.now() - began > budget) break;
    }
    if (this.atEnd()) { this.complete(); return; }
    if (o.intervalMs > 0) this.credit += (allowed - drawn) * o.intervalMs; // hand back time not used
    this.schedule();
  }

  private complete(): void
  {
    const done = this.opts?.onDone;
    this.opts = null;
    this.handle = null;
    done?.();
  }
}
