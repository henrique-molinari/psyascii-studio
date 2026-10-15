// Efeitos de cor: 'hue' (rotação de matiz no tempo) e 'aberr' (aberração cromática por células).
import type { ColorFrameCtx } from '../core/color';
import type { CellStage, FrameCtx } from '../core/types';

let copy = new Uint8ClampedArray(0);

const hueStage: CellStage = (c: FrameCtx) => {
  const f = c.params.fx.hue;
  if (!f.on) return;
  const d = (c as ColorFrameCtx).colors, n = c.cols * c.rows;
  const a = c.t * (0.3 + f.speed * 3);
  const co = Math.cos(a), si = Math.sin(a);
  // Matriz de rotação de matiz (eixo de luma).
  const m0 = 0.213 + co * 0.787 - si * 0.213, m1 = 0.715 - co * 0.715 - si * 0.715, m2 = 0.072 - co * 0.072 + si * 0.928;
  const m3 = 0.213 - co * 0.213 + si * 0.143, m4 = 0.715 + co * 0.285 + si * 0.140, m5 = 0.072 - co * 0.072 - si * 0.283;
  const m6 = 0.213 - co * 0.213 - si * 0.787, m7 = 0.715 - co * 0.715 + si * 0.715, m8 = 0.072 + co * 0.928 + si * 0.072;
  const k = Math.min(1, f.amt * 2) * c.params.mix, j = 1 - k;
  for (let i = 0; i < n; i++) {
    const o = i * 4, r = d[o], g = d[o + 1], b = d[o + 2];
    d[o] = r * j + (r * m0 + g * m1 + b * m2) * k;
    d[o + 1] = g * j + (r * m3 + g * m4 + b * m5) * k;
    d[o + 2] = b * j + (r * m6 + g * m7 + b * m8) * k;
  }
};

const aberrStage: CellStage = (c: FrameCtx) => {
  const f = c.params.fx.aberr;
  if (!f.on) return;
  const d = (c as ColorFrameCtx).colors, cols = c.cols, rows = c.rows, len = cols * rows * 4;
  if (copy.length !== len) copy = new Uint8ClampedArray(len);
  copy.set(d.subarray(0, len));
  const s = Math.max(1, Math.ceil(f.amt * 5 * (0.6 + 0.4 * Math.sin(c.t * (0.5 + f.speed * 3)))));
  const k = c.params.mix, j = 1 - k;
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const xr = x + s < cols ? x + s : cols - 1, xb = x - s >= 0 ? x - s : 0;
      const o = (row + x) * 4;
      d[o] = copy[o] * j + copy[(row + xr) * 4] * k;
      d[o + 2] = copy[o + 2] * j + copy[(row + xb) * 4 + 2] * k;
    }
  }
};

export const colorStages: CellStage[] = [hueStage, aberrStage];
