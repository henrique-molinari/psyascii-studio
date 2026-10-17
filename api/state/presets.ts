// Presets originais e "Surpreenda-me" com limites seguros.
import { EFFECT_IDS, POST_IDS, CHARSETS, PALETTE_IDS, clampParams } from '../core/types';
import type { Params, FxState, EffectId, PostId } from '../core/types';

const fx = (on: boolean, amt: number, speed: number): FxState => ({ on, amt, speed });
type Spec<K extends string> = Partial<Record<K, [number, number]>>;
function build<K extends string>(ids: readonly K[], s: Spec<K>): Record<K, FxState> {
  const o = {} as Record<K, FxState>;
  for (const id of ids) { const v = s[id]; o[id] = v ? fx(true, v[0], v[1]) : fx(false, 0.5, 0.5); }
  return o;
}
const F = (s: Spec<EffectId>) => build(EFFECT_IDS, s);
const P = (s: Spec<PostId>) => build(POST_IDS, s);

export const PRESETS: { name: string; params: Partial<Params> }[] = [
  { name: 'Chuva Verde', params: { charset: 'katakana', fontFamily: 'kana', colorMode: 'lum', palette: 'fosforo-verde', fx: F({ rain: [0.6, 0.5] }), post: P({ glow: [0.5, 0.5], scan: [0.3, 0.5], vignette: [0.5, 0.5] }) } },
  { name: 'Eco do Servidor', params: { charset: 'binary', colorMode: 'lum', palette: 'ciano-termico', fx: F({ wave: [0.3, 0.3], jitter: [0.2, 0.3] }), post: P({ scan: [0.5, 0.5], vignette: [0.5, 0.5] }) } },
  { name: 'Código Ácido', params: { charset: 'classic', colorMode: 'hue', hueSpeed: 0.4, fx: F({ warp: [0.5, 0.4], hue: [0.5, 0.4] }), post: P({ glow: [0.6, 0.5] }) } },
  { name: 'Sinal Fantasma', params: { charset: 'blocks', colorMode: 'lum', palette: 'sinal-perdido', fx: F({ glitch: [0.4, 0.3], aberr: [0.4, 0.4] }), post: P({ grain: [0.4, 0.5], scan: [0.4, 0.5] }) } },
  { name: 'Maré de Fósforo', params: { charset: 'classic', colorMode: 'lum', palette: 'fosforo-verde', fx: F({ wave: [0.5, 0.4], melt: [0.3, 0.3] }), post: P({ glow: [0.5, 0.5], vignette: [0.6, 0.5] }) } },
  { name: 'Vórtice Neon', params: { charset: 'braille', colorMode: 'angle', palette: 'magenta-neon', fx: F({ vortex: [0.6, 0.4], aberr: [0.3, 0.4] }), post: P({ glow: [0.7, 0.5] }) } },
  { name: 'Caleidoscópio Térmico', params: { charset: 'blocks', colorMode: 'radius', palette: 'calor', kaleidoN: 8, fx: F({ kaleido: [0.6, 0.4], hue: [0.3, 0.3] }), post: P({ vignette: [0.5, 0.5] }) } },
  { name: 'Túnel de Âmbar', params: { charset: 'classic', colorMode: 'radius', palette: 'ambar-crt', fx: F({ tunnel: [0.6, 0.5] }), post: P({ scan: [0.5, 0.5], glow: [0.4, 0.5], vignette: [0.6, 0.5] }) } },
  { name: 'Aurora Corrompida', params: { charset: 'katakana', fontFamily: 'kana', colorMode: 'lum', palette: 'aurora-digital', fx: F({ warp: [0.4, 0.3], glitch: [0.3, 0.3] }), post: P({ glow: [0.5, 0.5] }) } },
  { name: 'Espelho Infravermelho', params: { charset: 'braille', colorMode: 'lum', palette: 'infravermelho', fx: F({ mirror: [0.6, 0.3], jitter: [0.2, 0.3] }), post: P({ grain: [0.3, 0.5], vignette: [0.5, 0.5] }) } },
  { name: 'Terminal Limpo', params: { charset: 'classic', colorMode: 'mono', palette: 'duotone-verde-preto', fx: F({}), post: P({ vignette: [0.4, 0.5] }) } },
];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DISTORT: EffectId[] = ['warp', 'wave', 'vortex', 'kaleido', 'mirror', 'tunnel', 'melt', 'jitter', 'glitch'];
const FREE: EffectId[] = ['hue', 'aberr', 'rain'];

export function randomizeParams(p: Params, seed: number): Params {
  const r = rng(seed);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const rv = (): [number, number] => [0.2 + r() * 0.5, 0.2 + r() * 0.6];
  const spec: Spec<EffectId> = {};
  const pool = [...DISTORT];
  const n = 1 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) spec[pool.splice(Math.floor(r() * pool.length), 1)[0]] = rv();
  if (r() < 0.6) spec[pick(FREE)] = rv();
  const charsets = CHARSETS.filter((c) => c !== 'custom');
  const modes = ['lum', 'angle', 'radius', 'hue'] as const;
  const charset = pick(charsets);
  const post: Spec<PostId> = { glow: [0.2 + r() * 0.4, 0.5], vignette: [0.3 + r() * 0.3, 0.5] };
  if (r() < 0.5) post.scan = [0.3, 0.5];
  return clampParams({
    ...p, fx: F(spec), post: P(post), seed: (seed >>> 0) || 1,
    charset, palette: pick(PALETTE_IDS), colorMode: pick(modes),
    fontFamily: charset === 'katakana' ? 'kana' : 'mono',
    kaleidoN: 3 + Math.floor(r() * 7), mix: 0.6 + r() * 0.4,
  });
}
