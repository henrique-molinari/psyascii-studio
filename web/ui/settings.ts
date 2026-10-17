// Configurações: toggles [ ON ]/[ OFF ] ligados às preferências + "rever abertura".
import { toggle, button } from './controls';
import type { Prefs } from '../../lib/state/prefs';

export interface PrefsApi {
  getPrefs(): Prefs;
  setPrefs(patch: Partial<Prefs>): Prefs;
  subscribe(fn: (p: Prefs) => void): () => void;
}

export function mountSettings(slot: HTMLElement, api: PrefsApi, onReplayIntro: () => void): { dispose(): void } {
  const sec = document.createElement('section');
  sec.className = 'sec';
  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'sec-h';
  head.textContent = '[--] CONFIGURAÇÕES';
  const body = document.createElement('div');
  body.className = 'sec-b';
  const setOpen = (o: boolean): void => { head.setAttribute('aria-expanded', String(o)); body.hidden = !o; };
  head.addEventListener('click', () => setOpen(head.getAttribute('aria-expanded') !== 'true'));
  setOpen(false);

  const noop = (): void => { /* sem histórico: preferências não entram no desfazer */ };
  const rows: { key: keyof Prefs; label: string; get(p: Prefs): boolean; patch(v: boolean): Partial<Prefs> }[] = [
    { key: 'intro', label: 'Animação de abertura', get: (p) => p.intro, patch: (v) => ({ intro: v }) },
    { key: 'ambient', label: 'Fundo ambiente (chuva)', get: (p) => p.ambient, patch: (v) => ({ ambient: v }) },
    { key: 'crt', label: 'Scanlines e vinheta CRT da interface', get: (p) => p.crt, patch: (v) => ({ crt: v }) },
    { key: 'fps', label: 'Indicador de FPS', get: (p) => p.fps, patch: (v) => ({ fps: v }) },
    { key: 'intensity', label: 'Movimento reduzido', get: (p) => p.intensity === 'reduced', patch: (v) => ({ intensity: v ? 'reduced' : 'normal' }) },
  ];
  const ctls = rows.map((r) => {
    const c = toggle(r.label, (v) => api.setPrefs(r.patch(v)), noop);
    body.append(c.el);
    return { r, c };
  });
  const replay = button('Rever abertura', onReplayIntro);
  body.append(replay.el);
  sec.append(head, body);
  slot.append(sec);

  const paint = (p: Prefs): void => { for (const { r, c } of ctls) c.set(r.get(p)); };
  paint(api.getPrefs());
  const unsub = api.subscribe(paint);
  return { dispose(): void { unsub(); sec.remove(); } };
}
