// Loop de animação: um único rAF, pausa em aba oculta, dt limitado.

export interface Loop {
  start(): void;
  stop(): void;
  pause(): void;
  toggle(): void;
  readonly running: boolean;
  readonly paused: boolean;
  dispose(): void;
}

const MAX_DT = 0.1; // segundos

/** fn(t, dt): t em segundos de animação (não avança em pausa), dt em segundos. */
export function createLoop(fn: (t: number, dt: number) => void): Loop {
  let raf = 0;
  let started = false;
  let userPaused = false;
  let last = 0;
  let t = 0;
  let disposed = false;

  const hidden = (): boolean => typeof document !== 'undefined' && document.hidden;
  const shouldRun = (): boolean => started && !userPaused && !hidden() && !disposed;

  function tick(now: number): void {
    raf = 0;
    if (!shouldRun()) return;
    const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
    last = now;
    t += dt;
    fn(t, dt);
    if (shouldRun() && !raf) raf = requestAnimationFrame(tick);
  }

  function schedule(): void {
    if (raf || !shouldRun()) return;
    last = performance.now(); // evita salto de dt ao retomar
    raf = requestAnimationFrame(tick);
  }

  function cancel(): void {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  const onVisibility = (): void => { if (hidden()) cancel(); else schedule(); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  return {
    start() { if (disposed) return; started = true; userPaused = false; schedule(); },
    stop() { started = false; userPaused = false; t = 0; cancel(); },
    pause() { userPaused = true; cancel(); },
    toggle() {
      if (disposed) return;
      if (!started) { started = true; userPaused = false; } else userPaused = !userPaused;
      if (userPaused) cancel(); else schedule();
    },
    get running() { return shouldRun(); },
    get paused() { return userPaused; },
    dispose() {
      disposed = true; started = false;
      cancel();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
