// Funções puras de tom. Sem alocação por chamada: buffers são fornecidos.

/** Luminância perceptual Rec.709 (valores sRGB 0-255 -> 0..1, aproximação gama 2). */
export function luminance(r: number, g: number, b: number): number {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  return Math.sqrt(0.2126 * rr * rr + 0.7152 * gg * gg + 0.0722 * bb * bb);
}

/** RGBA (ImageData) -> lum/r/g/b. alpha<128 vira branco (fundo claro). */
export function fillLuminance(
  rgba: Uint8ClampedArray, n: number, lum: Float32Array,
  r: Uint8ClampedArray, g: Uint8ClampedArray, b: Uint8ClampedArray,
): void {
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = rgba[j + 3] / 255;
    const rr = rgba[j] * a + 255 * (1 - a), gg = rgba[j + 1] * a + 255 * (1 - a), bb = rgba[j + 2] * a + 255 * (1 - a);
    r[i] = rr; g[i] = gg; b[i] = bb;
    lum[i] = luminance(rr, gg, bb);
  }
}

/** Curva de tom de um valor: brilho, contraste (pivô 0.5), gama, invert. Retorna 0..1. */
export function toneCurve(v: number, contrast: number, gamma: number, brightness: number, invert: boolean): number {
  let x = (v - 0.5) * contrast + 0.5 + brightness;
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  x = Math.pow(x, 1 / gamma);
  return invert ? 1 - x : x;
}

/** Aplica toneCurve in-place sobre n valores. */
export function applyTone(
  buf: Float32Array, n: number, contrast: number, gamma: number, brightness: number, invert: boolean,
): void {
  for (let i = 0; i < n; i++) buf[i] = toneCurve(buf[i], contrast, gamma, brightness, invert);
}

/** Sobel: magnitude normalizada 0..1 de src (w×h) em out. Borda por clamp. */
export function sobel(src: Float32Array, w: number, h: number, out: Float32Array): void {
  const w1 = w - 1, h1 = h - 1;
  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : 0) * w, y0 = y * w, yp = (y < h1 ? y + 1 : h1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < w1 ? x + 1 : w1;
      const a = src[ym + xm], b = src[ym + x], c = src[ym + xp];
      const d = src[y0 + xm], f = src[y0 + xp];
      const g = src[yp + xm], hh = src[yp + x], i = src[yp + xp];
      const gx = c + 2 * f + i - a - 2 * d - g;
      const gy = g + 2 * hh + i - a - 2 * b - c;
      const m = Math.sqrt(gx * gx + gy * gy) / 5.657; // máx teórico 4*sqrt2
      out[y0 + x] = m > 1 ? 1 : m;
    }
  }
}

/** Mistura bordas: lum = lum*(1-amt) + max(lum, edge)*amt (realce de contornos). */
export function mixEdges(lum: Float32Array, edge: Float32Array, n: number, amt: number): void {
  for (let i = 0; i < n; i++) {
    const e = edge[i] * 1.5, l = lum[i];
    lum[i] = l * (1 - amt) + (e > l ? e : l) * amt;
  }
}

const BAYER4 = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

/** Limiar Bayer 4x4 em -0.5..0.5 (soma-se ao valor antes de quantizar). */
export function bayer4(x: number, y: number): number {
  return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16 - 0.5;
}

/** Dither ordenado in-place: lum += bayer*(1/levels) e mantém 0..1. */
export function ditherOrdered(lum: Float32Array, w: number, h: number, levels: number): void {
  const k = 1 / Math.max(2, levels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = lum[i] + bayer4(x, y) * k;
      lum[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
}

/** Remoção de fundo claro: mask=0 onde lum>=limiar(1-cut) ; cut=0 desliga (mask=1). */
export function backgroundMask(lum: Float32Array, n: number, cut: number, mask: Uint8Array): void {
  if (cut <= 0) { mask.fill(1, 0, n); return; }
  const th = 1 - cut * 0.5; // cut=1 -> limiar 0.5
  for (let i = 0; i < n; i++) mask[i] = lum[i] >= th ? 0 : 1;
}

/** RNG seedado mulberry32: retorna função 0..1. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash determinístico 2D -> 0..1 (sem estado). */
export function hash2d(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
