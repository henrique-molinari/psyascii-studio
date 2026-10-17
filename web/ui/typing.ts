// Digitação com cursor ▮ (piscar ≤1 Hz via CSS .typing-cursor), pulável.
export interface TypeOpts { cps?: number; reduced?: boolean; signal?: AbortSignal }
export interface TypeHandle { skip(): void; done: Promise<void> }

export function typeText(el: HTMLElement, text: string, opts: TypeOpts = {}): TypeHandle {
  const cps = Math.max(1, opts.cps ?? 40);
  const textNode = document.createTextNode('');
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.textContent = '▮';
  el.append(textNode, cursor);

  let finished = false;
  let raf = 0;
  let resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });
  const finish = (): void => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    opts.signal?.removeEventListener('abort', finish);
    textNode.data = text;
    cursor.remove();
    resolve();
  };

  if (opts.reduced || opts.signal?.aborted) {
    finish();
    return { skip: finish, done };
  }
  opts.signal?.addEventListener('abort', finish);
  const t0 = performance.now();
  const tick = (now: number): void => {
    if (finished) return;
    const n = Math.min(text.length, Math.floor(((now - t0) / 1000) * cps));
    if (n >= text.length) { finish(); return; }
    textNode.data = text.slice(0, n);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { skip: finish, done };
}
