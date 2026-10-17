import { describe, expect, it } from 'vitest';
import { autoBackgroundMask } from '../lib/core/tone';

function img(cols: number, rows: number, bg: number, fg: number, inner?: [number, number, number, number]) {
  const n = cols * rows;
  const r = new Uint8ClampedArray(n), g = new Uint8ClampedArray(n), b = new Uint8ClampedArray(n);
  r.fill(bg); g.fill(bg); b.fill(bg);
  const [x0, y0, x1, y1] = inner ?? [0, 0, -1, -1];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { r[y * cols + x] = fg; g[y * cols + x] = fg; b[y * cols + x] = fg; }
  return { r, g, b, n };
}
const run = (i: ReturnType<typeof img>, cols: number, rows: number, tol: number) => {
  const mask = new Uint8Array(i.n).fill(1);
  autoBackgroundMask(i.r, i.g, i.b, cols, rows, tol, mask, new Int32Array(i.n));
  return mask;
};

describe('autoBackgroundMask', () => {
  it('remove fundo uniforme e mantém o sujeito central', () => {
    const i = img(8, 8, 250, 20, [2, 2, 5, 5]);
    const m = run(i, 8, 8, 0.25);
    expect(m[0]).toBe(0); expect(m[63]).toBe(0);
    expect(m[3 * 8 + 3]).toBe(1);
    expect(m.reduce((a, v) => a + v, 0)).toBe(16);
  });
  it('preserva interior com cor igual ao fundo', () => {
    const i = img(9, 9, 255, 0, [1, 1, 7, 7]);
    const c = 4 * 9 + 4;
    i.r[c] = i.g[c] = i.b[c] = 255;
    const m = run(i, 9, 9, 0.1);
    expect(m[c]).toBe(1);
    expect(m[0]).toBe(0);
  });
  it('tol 0 remove só cores idênticas; tol 1 remove tudo', () => {
    const i = img(6, 6, 200, 190, [2, 2, 3, 3]);
    const m0 = run(i, 6, 6, 0);
    expect(m0[2 * 6 + 2]).toBe(1); expect(m0[0]).toBe(0);
    expect(run(i, 6, 6, 1).every((v) => v === 0)).toBe(true);
  });
  it('imagem 1x1 não quebra', () => {
    const i = img(1, 1, 100, 100);
    expect(run(i, 1, 1, 0)[0]).toBe(0);
  });
});
