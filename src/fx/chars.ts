// Efeitos de caracteres: 'rain' (chuva digital sobre a imagem) e 'melt' (onda que desloca a rampa).
import type { CellStage, FrameCtx } from '../core/types';

function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const rainStage: CellStage = (ctx: FrameCtx) => {
  const f = ctx.params.fx.rain;
  if (!f.on) return;
  const { cols, rows, lum, glyphOverride, mask, t } = ctx;
  const seed = ctx.params.seed | 0, mix = ctx.params.mix;
  if (mix < 0.05) return;
  const tail = 6 + f.amt * 16;
  const span = rows + tail;
  const tick = Math.floor(t * 3);
  for (let x = 0; x < cols; x++) {
    const h = hash(x, seed, 1);
    const colSpeed = (3 + (h & 15) * 0.9) * (0.25 + f.speed * 1.5); // células/s
    const head = ((h >>> 8) % 1000 / 1000 * span + t * colSpeed) % span - tail * 0.25;
    for (let y = 0; y < rows; y++) {
      const d = head - y;
      if (d < 0 || d >= tail) continue;
      const i = y * cols + x;
      if (!mask[i]) continue;
      const k = d < 1 ? 1 : 1 - d / tail;
      const v = (k * (0.35 + 0.65 * f.amt + 0.2)) * mix;
      const cur = lum[i];
      if (v > cur) lum[i] = v > 1 ? 1 : v;
      if (k > 0.25 || d < 1) glyphOverride[i] = hash(x, y, tick + ((h >>> 4) & 7)) & 0x7fff;
    }
  }
};

const meltStage: CellStage = (ctx: FrameCtx) => {
  const f = ctx.params.fx.melt;
  if (!f.on) return;
  const { cols, rows, shift, mask, t } = ctx;
  const a = f.amt * 0.45 * ctx.params.mix;
  const w = t * (0.4 + f.speed * 2.2);
  for (let y = 0; y < rows; y++) {
    const ry = y * 0.28 - w;
    for (let x = 0; x < cols; x++) {
      if (!mask[y * cols + x]) continue;
      shift[y * cols + x] += a * (Math.sin(ry + x * 0.09) * 0.7 + Math.sin(ry * 0.5 - x * 0.17 + w * 0.3) * 0.3);
    }
  }
};

export const charStages: CellStage[] = [rainStage, meltStage];
