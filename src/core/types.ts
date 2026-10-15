// Tipos do contrato, defaults e validação de parâmetros (JSON puro).

export const EFFECT_IDS = ['warp', 'wave', 'vortex', 'kaleido', 'mirror', 'tunnel', 'hue', 'aberr', 'rain', 'melt', 'jitter', 'glitch'] as const;
export const POST_IDS = ['glow', 'scan', 'vignette', 'grain'] as const;
export const PALETTE_IDS = [
  'fosforo-verde', 'ambar-crt', 'ciano-termico', 'magenta-neon', 'acido-roxo', 'infravermelho',
  'arco-iris-corrompido', 'duotone-verde-preto', 'calor', 'aurora-digital', 'sinal-perdido', 'glitch-rgb',
] as const;
export const CHARSETS = ['classic', 'blocks', 'braille', 'katakana', 'binary', 'custom'] as const;
export const COLOR_MODES = ['mono', 'original', 'lum', 'angle', 'radius', 'hue'] as const;
export const INTERACT_MODES = ['off', 'repel', 'attract', 'ripple', 'reveal'] as const;
export const FONT_FAMILIES = ['mono', 'kana'] as const;

export type EffectId = (typeof EFFECT_IDS)[number];
export type PostId = (typeof POST_IDS)[number];
export type PaletteId = (typeof PALETTE_IDS)[number];
export type CharsetId = (typeof CHARSETS)[number];
export type ColorMode = (typeof COLOR_MODES)[number];
export type InteractMode = (typeof INTERACT_MODES)[number];
export type FontFamilyId = (typeof FONT_FAMILIES)[number];

export interface FxState { on: boolean; amt: number; speed: number }

export interface Params {
  cols: number; cellAspect: number; contrast: number; gamma: number; brightness: number;
  invert: boolean; edges: number; dither: boolean; bgCut: number;
  charset: CharsetId; custom: string; fontSize: number; fontFamily: FontFamilyId;
  colorMode: ColorMode; palette: PaletteId; hueSpeed: number;
  fx: Record<EffectId, FxState>; mix: number;
  post: Record<PostId, FxState>;
  kaleidoN: number; interact: InteractMode; interactRadius: number; seed: number;
}

// Limites [min, max, padrão] das numéricas.
export const LIMITS = {
  cols: [20, 300, 160], cellAspect: [0.3, 1, 0.5], contrast: [0, 2, 1], gamma: [0.3, 3, 1],
  brightness: [-1, 1, 0], edges: [0, 1, 0], bgCut: [0, 1, 0], fontSize: [8, 24, 12],
  hueSpeed: [0, 1, 0.2], mix: [0, 1, 1], kaleidoN: [2, 12, 6], interactRadius: [2, 40, 12],
} as const;
export const MAX_IMAGE_PX = 2048;
export const MAX_CUSTOM_CHARS = 64;

export interface Grid {
  cols: number; rows: number; lum: Float32Array;
  r: Uint8ClampedArray; g: Uint8ClampedArray; b: Uint8ClampedArray; mask: Uint8Array;
}
export interface Pointer { x: number; y: number; down: boolean; active: boolean }
export interface FrameCtx {
  params: Params; t: number; dt: number; grid: Grid; cols: number; rows: number;
  lum: Float32Array; r: Uint8ClampedArray; g: Uint8ClampedArray; b: Uint8ClampedArray; mask: Uint8Array;
  shift: Float32Array; glyphOverride: Int16Array; ptr: Pointer;
}
export interface WarpEffect {
  id: string; enabled(p: Params): boolean; prepare(ctx: FrameCtx): void;
  map(x: number, y: number, out: Float32Array): void;
}
export type CellStage = (ctx: FrameCtx) => void;
export interface PostStage { id: string; draw(c: CanvasRenderingContext2D, w: number, h: number, ctx: FrameCtx): void }
export interface Pipeline {
  warps: WarpEffect[]; cellStages: CellStage[]; colorStages: CellStage[]; post: PostStage[];
  resize(cols: number, rows: number): void; dispose(): void;
}

const fx = (on = false, amt = 0.5, speed = 0.5): FxState => ({ on, amt, speed });

export function defaultParams(): Params {
  const L = LIMITS;
  const f = {} as Record<EffectId, FxState>;
  for (const id of EFFECT_IDS) f[id] = fx();
  const p = {} as Record<PostId, FxState>;
  for (const id of POST_IDS) p[id] = fx(id === 'vignette', 0.5, 0.5);
  return {
    cols: L.cols[2], cellAspect: L.cellAspect[2], contrast: L.contrast[2], gamma: L.gamma[2],
    brightness: L.brightness[2], invert: false, edges: L.edges[2], dither: false, bgCut: L.bgCut[2],
    charset: 'classic', custom: '', fontSize: L.fontSize[2], fontFamily: 'mono',
    colorMode: 'mono', palette: 'fosforo-verde', hueSpeed: L.hueSpeed[2],
    fx: f, mix: L.mix[2], post: p, kaleidoN: L.kaleidoN[2], interact: 'off',
    interactRadius: L.interactRadius[2], seed: 1,
  };
}

function num(v: unknown, lim: readonly [number, number, number]): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : lim[2];
  return Math.min(lim[1], Math.max(lim[0], n));
}
function oneOf<T extends string>(v: unknown, list: readonly T[], def: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : def;
}
function fxState(v: unknown, def: FxState): FxState {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<FxState>;
  const c01 = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);
  return { on: typeof o.on === 'boolean' ? o.on : def.on, amt: c01(o.amt, def.amt), speed: c01(o.speed, def.speed) };
}
/** Remove controles, limita a 64 pontos de código. */
export function sanitizeCustom(s: unknown): string {
  if (typeof s !== 'string') return '';

  const bad = (c: number) => c < 32 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 || (c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069) || c === 0xfeff;
  return Array.from(s).filter((ch) => !bad(ch.codePointAt(0) as number)).slice(0, MAX_CUSTOM_CHARS).join('');
}

export function clampParams(input: Partial<Params>): Params {
  const d = defaultParams();
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const L = LIMITS;
  const f = {} as Record<EffectId, FxState>;
  const p = {} as Record<PostId, FxState>;
  const ifx = (i.fx && typeof i.fx === 'object' ? i.fx : {}) as Record<string, unknown>;
  const ipo = (i.post && typeof i.post === 'object' ? i.post : {}) as Record<string, unknown>;
  for (const id of EFFECT_IDS) f[id] = fxState(ifx[id], d.fx[id]);
  for (const id of POST_IDS) p[id] = fxState(ipo[id], d.post[id]);
  const seed = typeof i.seed === 'number' && Number.isFinite(i.seed) ? Math.floor(i.seed) >>> 0 : d.seed;
  return {
    cols: Math.round(num(i.cols, L.cols)), cellAspect: num(i.cellAspect, L.cellAspect),
    contrast: num(i.contrast, L.contrast), gamma: num(i.gamma, L.gamma), brightness: num(i.brightness, L.brightness),
    invert: i.invert === true, edges: num(i.edges, L.edges), dither: i.dither === true, bgCut: num(i.bgCut, L.bgCut),
    charset: oneOf(i.charset, CHARSETS, d.charset), custom: sanitizeCustom(i.custom),
    fontSize: Math.round(num(i.fontSize, L.fontSize)), fontFamily: oneOf(i.fontFamily, FONT_FAMILIES, d.fontFamily),
    colorMode: oneOf(i.colorMode, COLOR_MODES, d.colorMode), palette: oneOf(i.palette, PALETTE_IDS, d.palette),
    hueSpeed: num(i.hueSpeed, L.hueSpeed), fx: f, mix: num(i.mix, L.mix), post: p,
    kaleidoN: Math.round(num(i.kaleidoN, L.kaleidoN)), interact: oneOf(i.interact, INTERACT_MODES, d.interact),
    interactRadius: num(i.interactRadius, L.interactRadius), seed,
  };
}
