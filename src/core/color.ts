// Paletas psicodélicas (stops compactos) e coloração por célula. Sem alocação por quadro.
import type { FrameCtx, PaletteId } from './types';

export const PALETTES: { id: PaletteId; name: string }[] = [
  { id: 'fosforo-verde', name: 'Fósforo Verde' },
  { id: 'ambar-crt', name: 'Âmbar CRT' },
  { id: 'ciano-termico', name: 'Ciano Térmico' },
  { id: 'magenta-neon', name: 'Magenta Neon' },
  { id: 'acido-roxo', name: 'Ácido Roxo' },
  { id: 'infravermelho', name: 'Infravermelho' },
  { id: 'arco-iris-corrompido', name: 'Arco-íris Corrompido' },
  { id: 'duotone-verde-preto', name: 'Duotone Verde e Preto' },
  { id: 'calor', name: 'Calor' },
  { id: 'aurora-digital', name: 'Aurora Digital' },
  { id: 'sinal-perdido', name: 'Sinal Perdido' },
  { id: 'glitch-rgb', name: 'Glitch RGB' },
];

// Stops RGB (0-255) uniformemente espaçados em t 0..1.
const STOPS: Record<PaletteId, Float32Array> = {
  'fosforo-verde': new Float32Array([0, 40, 10, 0, 160, 40, 0, 255, 65, 214, 255, 224]),
  'ambar-crt': new Float32Array([40, 16, 0, 160, 80, 0, 255, 176, 0, 255, 232, 160]),
  'ciano-termico': new Float32Array([0, 20, 40, 0, 110, 170, 0, 230, 255, 220, 255, 255]),
  'magenta-neon': new Float32Array([30, 0, 40, 150, 0, 140, 255, 30, 220, 255, 190, 255]),
  'acido-roxo': new Float32Array([20, 0, 50, 90, 20, 190, 190, 60, 255, 120, 255, 90, 245, 255, 190]),
  'infravermelho': new Float32Array([0, 0, 40, 90, 0, 120, 230, 30, 40, 255, 160, 0, 255, 255, 220]),
  'arco-iris-corrompido': new Float32Array([255, 0, 80, 255, 200, 0, 0, 255, 120, 0, 140, 255, 190, 0, 255, 255, 0, 80]),
  'duotone-verde-preto': new Float32Array([0, 0, 0, 0, 255, 65]),
  'calor': new Float32Array([0, 0, 0, 120, 0, 0, 255, 70, 0, 255, 200, 0, 255, 255, 255]),
  'aurora-digital': new Float32Array([5, 10, 40, 0, 200, 140, 90, 120, 255, 220, 80, 255, 120, 255, 200]),
  'sinal-perdido': new Float32Array([10, 10, 14, 70, 80, 95, 150, 160, 170, 255, 70, 90, 235, 240, 245]),
  'glitch-rgb': new Float32Array([255, 0, 40, 0, 0, 0, 0, 255, 70, 0, 0, 0, 30, 90, 255, 255, 255, 255]),
};

/** Escreve o RGB da paleta em t01 (0..1) em out[o..o+2]. Sem alocação. */
export function paletteColor(id: PaletteId, t01: number, out: Uint8ClampedArray, o: number): void {
  const s = STOPS[id] ?? STOPS['fosforo-verde'];
  const n = s.length / 3 - 1;
  const t = (t01 < 0 ? 0 : t01 > 1 ? 1 : t01) * n;
  let k = t | 0;
  if (k >= n) k = n - 1;
  const f = t - k, a = k * 3;
  out[o] = s[a] + (s[a + 3] - s[a]) * f;
  out[o + 1] = s[a + 1] + (s[a + 4] - s[a + 1]) * f;
  out[o + 2] = s[a + 2] + (s[a + 5] - s[a + 2]) * f;
}

/** HSV (h 0..1, s,v 0..1) -> RGB 0-255 em out[o..]. */
export function hsvToRgb(h: number, s: number, v: number, out: Uint8ClampedArray, o: number): void {
  const hh = (h - Math.floor(h)) * 6;
  const i = hh | 0, f = hh - i;
  const p = v * (1 - s), q = v * (1 - s * f), u = v * (1 - s * (1 - f));
  let r = v, g = u, b = p;
  switch (i) {
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = u; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = u; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: break;
  }
  out[o] = r * 255; out[o + 1] = g * 255; out[o + 2] = b * 255;
}

/** FrameCtx estendido com o buffer RGBA cols×rows (ImageData.data) para os ColorStage. */
export type ColorFrameCtx = FrameCtx & { colors: Uint8ClampedArray };

/**
 * Preenche as cores por célula (RGBA, alpha 255) conforme params.colorMode.
 * `lum` é a luminância final por célula (0..1, já com shift).
 */
export function fillCellColors(ctx: FrameCtx, lum: Float32Array, img: ImageData): void {
  const { cols, rows, params, t } = ctx;
  const d = img.data, n = cols * rows, mode = params.colorMode, pal = params.palette;
  const drift = t * params.hueSpeed * 0.25;
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  const rmax = Math.sqrt(cx * cx + (cy * 2) * (cy * 2)) || 1; // linhas valem ~2 colunas
  for (let i = 0; i < n; i++) {
    const o = i * 4, l = lum[i] < 0 ? 0 : lum[i] > 1 ? 1 : lum[i];
    d[o + 3] = 255;
    if (mode === 'original') {
      d[o] = ctx.r[i]; d[o + 1] = ctx.g[i]; d[o + 2] = ctx.b[i];
      continue;
    }
    if (mode === 'mono') { paletteColor(pal, 0.8, d, o); continue; }
    if (mode === 'lum') { paletteColor(pal, l, d, o); continue; }
    const x = i % cols, y = (i / cols) | 0;
    const dx = x - cx, dy = (y - cy) * 2;
    let k = 1;
    if (mode === 'angle') {
      let u = Math.atan2(dy, dx) / 6.283185307 + 0.5 + drift;
      u -= Math.floor(u);
      paletteColor(pal, u < 0.5 ? u * 2 : 2 - u * 2, d, o); // vai e volta: sem emenda
    } else if (mode === 'radius') {
      let u = Math.sqrt(dx * dx + dy * dy) / rmax - drift;
      u -= Math.floor(u);
      paletteColor(pal, u < 0.5 ? u * 2 : 2 - u * 2, d, o);
    } else { // hue
      hsvToRgb(drift + l * 0.35 + (x / cols) * 0.3, 0.85, 1, d, o);
    }
    k = 0.45 + 0.55 * l;
    d[o] *= k; d[o + 1] *= k; d[o + 2] *= k;
  }
}
