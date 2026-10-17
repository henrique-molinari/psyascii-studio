// Fundo ambiente: RainEngine a baixa opacidade atrás dos painéis.
import { RainEngine } from '../../lib/fx/rain';
import { reducedMotion, subscribe, getPrefs } from '../../lib/state/prefs';
import './intro.css';

export function createAmbient(container: HTMLElement): { setEnabled(b: boolean): void; dispose(): void } {
  const canvas = document.createElement('canvas');
  canvas.className = 'ambient-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'none';
  container.prepend(canvas);
  let reduced = reducedMotion() || getPrefs().intensity === 'reduced';
  let engine: RainEngine | null = null;
  let enabled = false, raf = 0, last = 0, disposed = false;

  const size = (): void => {
    if (!engine) return;
    engine.resize(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1));
    if (reduced) { engine.step(0.5); engine.draw(); }
  };
  const frame = (now: number): void => {
    if (!enabled || !engine) return;
    engine.step(Math.min(0.05, (now - last) / 1000));
    last = now;
    engine.draw();
    raf = requestAnimationFrame(frame);
  };
  const vis = (): void => {
    cancelAnimationFrame(raf);
    if (enabled && engine && !reduced && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  const start = (): void => {
    engine = new RainEngine({ fontSize: 16, reduced });
    engine.attach(canvas);
    engine.setOpacity(0.12);
    size();
    vis();
  };
  const stop = (): void => {
    cancelAnimationFrame(raf);
    engine?.dispose();
    engine = null;
  };
  const onResize = (): void => size();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', vis);
  const unsub = subscribe((p) => {
    const r = reducedMotion() || p.intensity === 'reduced';
    if (r !== reduced) { reduced = r; if (enabled) { stop(); start(); } }
  });

  return {
    setEnabled(b: boolean): void {
      if (disposed || b === enabled) return;
      enabled = b;
      canvas.style.display = b ? '' : 'none';
      if (b) start(); else stop();
    },
    dispose(): void {
      disposed = true; enabled = false;
      stop(); unsub();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', vis);
      canvas.remove();
    },
  };
}
