// fx.tunnel: realimentação de luminância com zoom/rotação leve e rastro que se apaga.
import type { CellStage, FrameCtx } from '../core/types';

let prev = new Float32Array(0);
let size = 0;
let pc = 0, pr = 0;

export function resetFeedback(): void { prev = new Float32Array(0); size = 0; pc = 0; pr = 0; }

export const tunnelStage: CellStage = (ctx: FrameCtx) => {
  const f = ctx.params.fx.tunnel;
  const n = ctx.cols * ctx.rows;
  if (n !== size || ctx.cols !== pc || ctx.rows !== pr) { prev = new Float32Array(n); size = n; pc = ctx.cols; pr = ctx.rows; }
  if (!f.on) { prev.fill(0); return; }
  const { cols, rows, lum, mask } = ctx;
  const mix = ctx.params.mix;
  const decay = 0.72 + 0.26 * f.amt;
  const zoom = 1 + 0.01 + 0.05 * f.amt;
  const ang = (0.01 + 0.04 * f.speed) * Math.sin(ctx.t * (0.3 + f.speed));
  const ca = Math.cos(ang) * zoom, sa = Math.sin(ang) * zoom;
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  for (let y = 0; y < rows; y++) {
    const dy = (y - cy) * 2; // células são ~2x mais altas que largas
    for (let x = 0; x < cols; x++) {
      const dx = x - cx;
      const sx = Math.round(cx + dx * ca - dy * sa);
      const sy = Math.round(cy + (dx * sa + dy * ca) / 2);
      const i = y * cols + x;
      if (!mask[i]) continue;
      let old = 0;
      if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) old = prev[sy * cols + sx] * decay;
      const cur = lum[i];
      const res = cur > old ? cur : old;
      // 'prev' é lido por vizinhos já processados: grava num segundo passe abaixo.
      lum[i] = cur + (res - cur) * mix;
    }
  }
  // Atualiza o histórico depois de ler tudo (evita ler valores do mesmo quadro).
  for (let i = 0; i < n; i++) prev[i] = mask[i] ? lum[i] : 0;
};
