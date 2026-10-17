// Preferências persistentes (localStorage com try/catch) e movimento reduzido.
export interface Prefs {
  intro: boolean; ambient: boolean; crt: boolean; fps: boolean;
  seenWarning: boolean; intensity: 'normal' | 'reduced';
}
const KEY = 'psyascii.prefs';
const DEFAULTS: Prefs = { intro: true, ambient: true, crt: true, fps: false, seenWarning: false, intensity: 'normal' };
const subs = new Set<(p: Prefs) => void>();
let cache: Prefs | null = null;

function load(): Prefs {
  const p: Prefs = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Record<string, unknown>;
      for (const k of ['intro', 'ambient', 'crt', 'fps', 'seenWarning'] as const) {
        if (typeof o[k] === 'boolean') p[k] = o[k] as boolean;
      }
      if (o.intensity === 'normal' || o.intensity === 'reduced') p.intensity = o.intensity;
    }
  } catch { /* localStorage indisponível ou JSON inválido */ }
  return p;
}

export function getPrefs(): Prefs {
  if (!cache) cache = load();
  return { ...cache };
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  cache = { ...getPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignora */ }
  const snap = { ...cache };
  subs.forEach((f) => f(snap));
  return snap;
}

export function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Retorna a função de cancelamento. */
export function subscribe(fn: (p: Prefs) => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
