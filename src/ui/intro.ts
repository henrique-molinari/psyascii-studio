// Abertura: aviso de fotossensibilidade (1ª visita) + chuva + boot digitado + revelação.
import { RainEngine } from '../fx/rain';
import { typeText } from './typing';
import type { TypeHandle } from './typing';
import { getPrefs, setPrefs } from './prefs';
import './intro.css';

const LINES = ['> inicializando PsyASCII Studio...', '> carregando módulos...', '> pronto'];
const REVEAL_MS = 1100;

export function runIntro(opts: { container: HTMLElement; reduced: boolean }): Promise<void> {
  const { container, reduced } = opts;
  const first = !getPrefs().seenWarning;
  if (!first && !getPrefs().intro) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const prev = document.activeElement as HTMLElement | null;
    const ac = new AbortController();
    const overlay = document.createElement('div');
    overlay.className = 'intro-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Abertura do PsyASCII Studio');
    const canvas = document.createElement('canvas');
    canvas.className = 'intro-canvas';
    const boot = document.createElement('div');
    boot.className = 'intro-boot';
    boot.setAttribute('aria-live', 'polite');
    const scan = document.createElement('div');
    scan.className = 'intro-scan';
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'intro-btn intro-skip';
    skipBtn.textContent = '[ PULAR ]';
    overlay.append(canvas, boot, scan, skipBtn);
    container.appendChild(overlay);

    const engine = new RainEngine({ fontSize: 16, reduced });
    engine.attach(canvas);
    const size = (): void => {
      engine.resize(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1));
      if (reduced) { engine.step(0.5); engine.draw(); }
    };
    size();

    let raf = 0, last = performance.now();
    let ending = false, over = false, started = false;
    let revealStart = -1, hardTimer = 0, seqTimer = 0;
    let typing: TypeHandle | null = null;
    let warn: HTMLElement | null = null;

    const cleanup = (): void => {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      clearTimeout(hardTimer); clearTimeout(seqTimer);
      ac.abort();
      window.removeEventListener('resize', size);
      engine.dispose();
      overlay.remove();
      if (prev && document.contains(prev)) prev.focus();
      resolve();
    };
    const finish = (): void => {
      if (ending || over) return;
      ending = true;
      typing?.skip();
      clearTimeout(hardTimer); clearTimeout(seqTimer);
      overlay.classList.add('is-ending');
      setTimeout(cleanup, reduced ? 250 : 380);
    };
    const frame = (now: number): void => {
      if (over) return;
      engine.step(Math.min(0.05, (now - last) / 1000));
      last = now;
      if (revealStart >= 0) {
        const p = Math.min(1, (now - revealStart) / REVEAL_MS);
        engine.setReveal(p);
        if (p >= 1) finish();
      }
      engine.draw();
      if (!ending) raf = requestAnimationFrame(frame);
    };

    const sequence = async (): Promise<void> => {
      if (started) return;
      started = true;
      warn?.remove();
      skipBtn.hidden = false;
      skipBtn.focus();
      hardTimer = window.setTimeout(finish, 3800); // teto: nunca >4 s
      if (reduced) { seqTimer = window.setTimeout(finish, 600); return; }
      for (const line of LINES) {
        if (ending || over) return;
        const row = document.createElement('div');
        boot.appendChild(row);
        typing = typeText(row, line, { cps: 45, signal: ac.signal });
        await typing.done;
      }
      if (ending || over) return;
      seqTimer = window.setTimeout(() => {
        revealStart = performance.now();
        overlay.classList.add('is-revealing');
      }, 250);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (first) setPrefs({ seenWarning: true });
        finish();
      } else if (e.key === 'Tab') { // mantém o foco dentro do diálogo
        const t = warn && !started ? warn.querySelector('button') : skipBtn;
        e.preventDefault();
        t?.focus();
      }
    };
    document.addEventListener('keydown', onKey, { signal: ac.signal });
    window.addEventListener('resize', size);
    skipBtn.addEventListener('click', (e) => { e.stopPropagation(); finish(); }, { signal: ac.signal });
    overlay.addEventListener('click', () => { if (started) finish(); }, { signal: ac.signal });

    if (!reduced) raf = requestAnimationFrame(frame);
    if (first) {
      skipBtn.hidden = true;
      warn = document.createElement('div');
      warn.className = 'intro-warning';
      const h = document.createElement('h2');
      h.textContent = 'AVISO DE FOTOSSENSIBILIDADE';
      const p = document.createElement('p');
      p.textContent = 'Este site usa chuva de caracteres animada e efeitos visuais intensos que podem causar desconforto em pessoas sensíveis a luz e movimento. Você pode pular a abertura e reduzir os efeitos nas configurações.';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'intro-btn';
      go.textContent = '[ ENTRAR ]';
      go.addEventListener('click', (e) => {
        e.stopPropagation();
        setPrefs({ seenWarning: true });
        void sequence();
      }, { signal: ac.signal });
      warn.append(h, p, go);
      overlay.appendChild(warn);
      go.focus();
    } else {
      void sequence();
    }
  });
}
