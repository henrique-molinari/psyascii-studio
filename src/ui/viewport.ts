// Zoom (roda, pinça, botões) e arrasto do canvas dentro da moldura. Tudo removido em dispose().
export interface Viewport {
  zoomBy(f: number): void;
  fit(): void;
  reset(): void;
  readonly zoom: number;
  dispose(): void;
}

const MIN = 1, MAX = 8;

/** shouldPan: permite desligar o arrasto (ex.: quando o ponteiro interage com a imagem). */
export function createViewport(host: HTMLElement, target: HTMLElement, onChange: (z: number) => void, shouldPan: () => boolean = () => true): Viewport {
  const ac = new AbortController();
  const opt = { signal: ac.signal };
  let z = 1, x = 0, y = 0;
  const pts = new Map<number, { x: number; y: number }>();
  let pinch = 0, dragging = false;

  const apply = (): void => {
    const mx = (target.offsetWidth * (z - 1)) / 2, my = (target.offsetHeight * (z - 1)) / 2;
    x = Math.max(-mx, Math.min(mx, x));
    y = Math.max(-my, Math.min(my, y));
    if (z === 1) { x = 0; y = 0; }
    target.style.transform = z === 1 ? '' : `translate(${x}px, ${y}px) scale(${z})`;
    host.classList.toggle('zoomed', z > 1);
    onChange(z);
  };
  const setZoom = (nz: number): void => { z = Math.max(MIN, Math.min(MAX, nz)); apply(); };

  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false, signal: ac.signal });

  const dist = (): number => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  host.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) pinch = dist();
    dragging = pts.size === 1 && z > 1 && shouldPan();
    if (dragging || pts.size === 2) { try { host.setPointerCapture(e.pointerId); } catch { /* ignorado */ } }
  }, opt);
  host.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const d = dist();
      if (pinch > 0 && d > 0) setZoom(z * (d / pinch));
      pinch = d;
    } else if (dragging) {
      x += e.clientX - p.x; y += e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      apply();
    }
  }, opt);
  const up = (e: PointerEvent): void => {
    pts.delete(e.pointerId);
    pinch = 0; dragging = false;
    try { host.releasePointerCapture(e.pointerId); } catch { /* ignorado */ }
  };
  host.addEventListener('pointerup', up, opt);
  host.addEventListener('pointercancel', up, opt);

  const reset = (): void => { z = 1; x = 0; y = 0; apply(); };
  return {
    zoomBy: (f) => setZoom(z * f),
    fit: reset,
    reset,
    get zoom() { return z; },
    dispose(): void { ac.abort(); pts.clear(); target.style.transform = ''; host.classList.remove('zoomed'); },
  };
}
